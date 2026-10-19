import type { GreenhouseError } from "./errors.js";

export interface GreenhouseSuccess<T> {
  readonly success: true;
  readonly data: T;
}

export interface GreenhouseFailure {
  readonly success: false;
  readonly error: GreenhouseError;
}

/**
 * Discriminated union returned by every public Greenhouse client method.
 * Check `success` before accessing `data` or `error`.
 */
export type GreenhouseResult<T> = GreenhouseSuccess<T> | GreenhouseFailure;

export interface GreenhouseRequestOptions {
  /** Cancels the request and prevents further retry attempts. */
  readonly signal?: AbortSignal;
}

export interface GreenhouseGetJobsOptions extends GreenhouseRequestOptions {
  /** Includes the HTML job description when set to `true`. */
  readonly content?: boolean;
}

export interface GreenhouseRetryEvent {
  readonly attempt: number;
  readonly maxAttempts: number;
  readonly delayMs: number;
  readonly error: GreenhouseError;
  readonly url: string;
}

export type GreenhouseRetryHandler = (event: GreenhouseRetryEvent) => void;

export interface GreenhouseClientOptions {
  /** Defaults to the public Greenhouse boards API. */
  readonly baseUrl?: string;
  /** Timeout for a single HTTP attempt. */
  readonly timeoutMs?: number;
  /** Total number of attempts, including the initial request. */
  readonly maxAttempts?: number;
  readonly retryBaseDelayMs?: number;
  readonly retryMaxDelayMs?: number;
  /** Injectable fetch implementation for tests or custom runtimes. */
  readonly fetchImpl?: typeof fetch;
  /** Called before each retry attempt. */
  readonly onRetry?: GreenhouseRetryHandler;
}
