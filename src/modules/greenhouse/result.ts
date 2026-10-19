import type { GreenhouseFailure, GreenhouseSuccess } from "./client-types.js";
import type { GreenhouseError } from "./errors.js";

export function success<T>(data: T): GreenhouseSuccess<T> {
  return {
    success: true,
    data,
  };
}

export function failure(error: GreenhouseError): GreenhouseFailure {
  return {
    success: false,
    error,
  };
}
