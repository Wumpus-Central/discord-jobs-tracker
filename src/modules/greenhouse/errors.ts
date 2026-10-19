const MAX_ERROR_BODY_LENGTH = 500;

const RETRYABLE_HTTP_STATUSES: ReadonlySet<number> = new Set([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

export type GreenhouseErrorKind =
  | "aborted"
  | "http"
  | "input"
  | "network"
  | "parse"
  | "timeout"
  | "validation";

export type GreenhouseInputField = "boardToken" | "jobId";

interface GreenhouseErrorBase {
  readonly kind: GreenhouseErrorKind;
  readonly message: string;
  readonly url: string | null;
  readonly retryable: boolean;
}

export interface GreenhouseAbortedError extends GreenhouseErrorBase {
  readonly kind: "aborted";
  readonly url: string;
  readonly retryable: false;
}

export interface GreenhouseHttpError extends GreenhouseErrorBase {
  readonly kind: "http";
  readonly url: string;
  readonly status: number;
  readonly responseBody: string;
  readonly retryAfterMs: number | null;
}

export interface GreenhouseInputError extends GreenhouseErrorBase {
  readonly kind: "input";
  readonly url: null;
  readonly field: GreenhouseInputField;
  readonly retryable: false;
}

export interface GreenhouseNetworkError extends GreenhouseErrorBase {
  readonly kind: "network";
  readonly url: string;
  readonly cause: unknown;
  readonly retryable: true;
}

export interface GreenhouseParseError extends GreenhouseErrorBase {
  readonly kind: "parse";
  readonly url: string;
  readonly cause: unknown;
  readonly retryable: true;
}

export interface GreenhouseTimeoutError extends GreenhouseErrorBase {
  readonly kind: "timeout";
  readonly url: string;
  readonly timeoutMs: number;
  readonly retryable: true;
}

export interface GreenhouseValidationError extends GreenhouseErrorBase {
  readonly kind: "validation";
  readonly url: string;
  readonly details: string;
  readonly retryable: false;
}

export type GreenhouseError =
  | GreenhouseAbortedError
  | GreenhouseHttpError
  | GreenhouseInputError
  | GreenhouseNetworkError
  | GreenhouseParseError
  | GreenhouseTimeoutError
  | GreenhouseValidationError;

interface CreateAbortedErrorInput {
  readonly url: string;
}

interface CreateHttpErrorInput {
  readonly url: string;
  readonly status: number;
  readonly responseBody: string;
  readonly retryAfterMs: number | null;
}

interface CreateInputErrorInput {
  readonly field: GreenhouseInputField;
  readonly message: string;
}

interface CreateNetworkErrorInput {
  readonly url: string;
  readonly cause: unknown;
}

interface CreateParseErrorInput {
  readonly url: string;
  readonly message: string;
  readonly cause: unknown;
}

interface CreateTimeoutErrorInput {
  readonly url: string;
  readonly timeoutMs: number;
}

interface CreateValidationErrorInput {
  readonly url: string;
  readonly details: string;
}

export function createAbortedError(input: CreateAbortedErrorInput): GreenhouseAbortedError {
  return {
    kind: "aborted",
    message: "Greenhouse request was aborted",
    url: input.url,
    retryable: false,
  };
}

export function createHttpError(input: CreateHttpErrorInput): GreenhouseHttpError {
  return {
    kind: "http",
    message: `Greenhouse request failed with HTTP ${input.status}`,
    url: input.url,
    status: input.status,
    responseBody: input.responseBody.slice(0, MAX_ERROR_BODY_LENGTH),
    retryAfterMs: input.retryAfterMs,
    retryable: RETRYABLE_HTTP_STATUSES.has(input.status),
  };
}

export function createInputError(input: CreateInputErrorInput): GreenhouseInputError {
  return {
    kind: "input",
    message: input.message,
    url: null,
    field: input.field,
    retryable: false,
  };
}

export function createNetworkError(input: CreateNetworkErrorInput): GreenhouseNetworkError {
  return {
    kind: "network",
    message: "Greenhouse request failed because of a network error",
    url: input.url,
    cause: input.cause,
    retryable: true,
  };
}

export function createParseError(input: CreateParseErrorInput): GreenhouseParseError {
  return {
    kind: "parse",
    message: input.message,
    url: input.url,
    cause: input.cause,
    retryable: true,
  };
}

export function createTimeoutError(input: CreateTimeoutErrorInput): GreenhouseTimeoutError {
  return {
    kind: "timeout",
    message: `Greenhouse request timed out after ${input.timeoutMs}ms`,
    url: input.url,
    timeoutMs: input.timeoutMs,
    retryable: true,
  };
}

export function createValidationError(input: CreateValidationErrorInput): GreenhouseValidationError {
  return {
    kind: "validation",
    message: "Greenhouse response does not match the expected schema",
    url: input.url,
    details: input.details,
    retryable: false,
  };
}
