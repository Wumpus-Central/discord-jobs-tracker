import { setTimeout as delay } from "node:timers/promises";

import type {
  GreenhouseClientOptions,
  GreenhouseGetJobsOptions,
  GreenhouseRequestOptions,
  GreenhouseResult,
  GreenhouseRetryEvent,
  GreenhouseRetryHandler,
} from "./client-types.js";
import {
  createAbortedError,
  createHttpError,
  createNetworkError,
  createParseError,
  createTimeoutError,
  type GreenhouseError,
} from "./errors.js";
import { failure, success } from "./result.js";
import type { GreenhouseBoard, GreenhouseJob, GreenhouseJobsResponse } from "./types.js";
import {
  validateBoardResponse,
  validateBoardToken,
  validateJobId,
  validateJobResponse,
  validateJobsResponse,
} from "./validate.js";

const DEFAULT_BASE_URL = "https://boards-api.greenhouse.io/v1/boards";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 10_000;

const BACKOFF_MULTIPLIER = 2;
const JITTER_MIN_FACTOR = 0.8;
const JITTER_MAX_FACTOR = 1.2;

interface RetryNotificationInput {
  readonly attempt: number;
  readonly delayMs: number;
  readonly error: GreenhouseError;
  readonly url: string;
}

/**
 * Stateless client for the public Greenhouse job board API.
 * Requests are validated, retried on transient failures and never silently replaced with empty data.
 */
export class GreenhouseClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly retryBaseDelayMs: number;
  private readonly retryMaxDelayMs: number;
  private readonly fetchImpl: typeof fetch;
  private readonly onRetry: GreenhouseRetryHandler | undefined;

  constructor(options: GreenhouseClientOptions = {}) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
    this.timeoutMs = resolvePositiveInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS, "timeoutMs");
    this.maxAttempts = resolvePositiveInteger(options.maxAttempts, DEFAULT_MAX_ATTEMPTS, "maxAttempts");
    this.retryBaseDelayMs = resolveNonNegativeInteger(
      options.retryBaseDelayMs,
      DEFAULT_RETRY_BASE_DELAY_MS,
      "retryBaseDelayMs",
    );
    this.retryMaxDelayMs = resolveNonNegativeInteger(
      options.retryMaxDelayMs,
      DEFAULT_RETRY_MAX_DELAY_MS,
      "retryMaxDelayMs",
    );

    if (this.retryMaxDelayMs < this.retryBaseDelayMs) {
      throw new RangeError("retryMaxDelayMs must be greater than or equal to retryBaseDelayMs");
    }

    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.onRetry = options.onRetry;
  }

  /** Fetches public metadata for a single Greenhouse board. */
  async getBoard(
    boardToken: string,
    options: GreenhouseRequestOptions = {},
  ): Promise<GreenhouseResult<GreenhouseBoard>> {
    const boardTokenResult = validateBoardToken(boardToken);

    if (!boardTokenResult.success) {
      return boardTokenResult;
    }

    const url = this.createUrl([boardTokenResult.data]);
    return this.requestAndValidate(url, options, validateBoardResponse);
  }

  /** Fetches every open job from a Greenhouse board. */
  async getJobs(
    boardToken: string,
    options: GreenhouseGetJobsOptions = {},
  ): Promise<GreenhouseResult<GreenhouseJobsResponse>> {
    const boardTokenResult = validateBoardToken(boardToken);

    if (!boardTokenResult.success) {
      return boardTokenResult;
    }

    const url = this.createUrl([boardTokenResult.data, "jobs"]);

    if (options.content === true) {
      url.searchParams.set("content", "true");
    }

    return this.requestAndValidate(url, options, validateJobsResponse);
  }

  /** Fetches a single job, including its HTML description. */
  async getJob(
    boardToken: string,
    jobId: number,
    options: GreenhouseRequestOptions = {},
  ): Promise<GreenhouseResult<GreenhouseJob>> {
    const boardTokenResult = validateBoardToken(boardToken);

    if (!boardTokenResult.success) {
      return boardTokenResult;
    }

    const jobIdResult = validateJobId(jobId);

    if (!jobIdResult.success) {
      return jobIdResult;
    }

    const url = this.createUrl([boardTokenResult.data, "jobs", String(jobIdResult.data)]);
    return this.requestAndValidate(url, options, validateJobResponse);
  }

  private createUrl(pathSegments: readonly string[]): URL {
    const encodedSegments = pathSegments.map((segment) => encodeURIComponent(segment));
    const url = [this.baseUrl, ...encodedSegments].join("/");
    return new URL(url);
  }

  private async requestAndValidate<T>(
    url: URL,
    options: GreenhouseRequestOptions,
    validator: (value: unknown, url: string) => GreenhouseResult<T>,
  ): Promise<GreenhouseResult<T>> {
    const responseResult = await this.requestJson(url, options);

    if (!responseResult.success) {
      return responseResult;
    }

    return validator(responseResult.data, url.toString());
  }

  private requestJson(url: URL, options: GreenhouseRequestOptions): Promise<GreenhouseResult<unknown>> {
    return this.requestJsonAttempt(url, options, 1);
  }

  private async requestJsonAttempt(
    url: URL,
    options: GreenhouseRequestOptions,
    attempt: number,
  ): Promise<GreenhouseResult<unknown>> {
    const result = await this.requestOnce(url, options);

    if (result.success) {
      return result;
    }

    if (!result.error.retryable) {
      return result;
    }

    if (attempt === this.maxAttempts) {
      return result;
    }

    const delayMs = this.calculateRetryDelayMs(attempt, result.error);
    this.emitRetry({ attempt, delayMs, error: result.error, url: url.toString() });
    await delay(delayMs);
    return this.requestJsonAttempt(url, options, attempt + 1);
  }

  private async requestOnce(url: URL, options: GreenhouseRequestOptions): Promise<GreenhouseResult<unknown>> {
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const requestSignal =
      options.signal === undefined ? timeoutSignal : AbortSignal.any([options.signal, timeoutSignal]);

    let response: Response;

    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: requestSignal,
      });
    } catch (cause) {
      return failure(this.createFetchError(url, cause, options.signal, timeoutSignal));
    }

    let responseBody: string;

    try {
      responseBody = await response.text();
    } catch (cause) {
      return failure(this.createFetchError(url, cause, options.signal, timeoutSignal));
    }

    if (!response.ok) {
      return failure(
        createHttpError({
          url: url.toString(),
          status: response.status,
          responseBody,
          retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
        }),
      );
    }

    return parseJsonResponse(responseBody, url.toString());
  }

  private createFetchError(
    url: URL,
    cause: unknown,
    callerSignal: AbortSignal | undefined,
    timeoutSignal: AbortSignal,
  ): GreenhouseError {
    const requestUrl = url.toString();

    if (callerSignal?.aborted === true) {
      return createAbortedError({ url: requestUrl });
    }

    if (timeoutSignal.aborted) {
      return createTimeoutError({ url: requestUrl, timeoutMs: this.timeoutMs });
    }

    return createNetworkError({ url: requestUrl, cause });
  }

  private calculateRetryDelayMs(attempt: number, error: GreenhouseError): number {
    const exponentialBackoffMs = this.retryBaseDelayMs * BACKOFF_MULTIPLIER ** (attempt - 1);
    const retryAfterMs = error.kind === "http" ? error.retryAfterMs : null;
    const requestedDelayMs = Math.max(exponentialBackoffMs, retryAfterMs ?? 0);
    const cappedDelayMs = Math.min(requestedDelayMs, this.retryMaxDelayMs);
    const jitteredDelayMs = applyJitter(cappedDelayMs);
    return Math.min(jitteredDelayMs, this.retryMaxDelayMs);
  }

  private emitRetry(input: RetryNotificationInput): void {
    if (this.onRetry === undefined) {
      return;
    }

    const event: GreenhouseRetryEvent = {
      attempt: input.attempt,
      maxAttempts: this.maxAttempts,
      delayMs: input.delayMs,
      error: input.error,
      url: input.url,
    };

    this.onRetry(event);
  }
}

export function createGreenhouseClient(options: GreenhouseClientOptions = {}): GreenhouseClient {
  return new GreenhouseClient(options);
}

export const greenhouse = createGreenhouseClient();

function normalizeBaseUrl(value: string): string {
  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    throw new Error("Greenhouse base URL must not be empty");
  }

  const parsedUrl = new URL(trimmedValue);

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Greenhouse base URL must use HTTP or HTTPS");
  }

  if (parsedUrl.search.length > 0 || parsedUrl.hash.length > 0) {
    throw new Error("Greenhouse base URL must not include a query or hash");
  }

  return trimmedValue.replace(/\/+$/, "");
}

function resolvePositiveInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }

  return value;
}

function resolveNonNegativeInteger(value: number | undefined, fallback: number, name: string): number {
  if (value === undefined) {
    return fallback;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }

  return value;
}

function parseJsonResponse(body: string, url: string): GreenhouseResult<unknown> {
  const trimmedBody = body.trim();

  if (trimmedBody.length === 0) {
    return failure(
      createParseError({
        url,
        message: "Greenhouse returned an empty response body",
        cause: null,
      }),
    );
  }

  try {
    const data: unknown = JSON.parse(trimmedBody);
    return success(data);
  } catch (cause) {
    return failure(
      createParseError({
        url,
        message: "Greenhouse returned invalid JSON",
        cause,
      }),
    );
  }
}

function parseRetryAfterMs(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const trimmedValue = value.trim();

  if (trimmedValue.length === 0) {
    return null;
  }

  const seconds = Number(trimmedValue);

  if (Number.isFinite(seconds)) {
    return Math.max(0, seconds * 1_000);
  }

  const retryAtMs = Date.parse(trimmedValue);

  if (Number.isNaN(retryAtMs)) {
    return null;
  }

  return Math.max(0, retryAtMs - Date.now());
}

function applyJitter(delayMs: number): number {
  if (delayMs <= 0) {
    return 0;
  }

  const jitterFactor = JITTER_MIN_FACTOR + Math.random() * (JITTER_MAX_FACTOR - JITTER_MIN_FACTOR);
  return Math.round(delayMs * jitterFactor);
}
