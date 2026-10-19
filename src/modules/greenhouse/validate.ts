import type { GreenhouseResult } from "./client-types.js";
import { createInputError, createValidationError } from "./errors.js";
import { failure, success } from "./result.js";
import type {
  GreenhouseBoard,
  GreenhouseDataCompliance,
  GreenhouseDepartment,
  GreenhouseJob,
  GreenhouseJobsMeta,
  GreenhouseJobsResponse,
  GreenhouseMetadata,
  GreenhouseMetadataValue,
  GreenhouseOffice,
} from "./types.js";

export function validateBoardToken(value: string): GreenhouseResult<string> {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return failure(
      createInputError({
        field: "boardToken",
        message: "Board token must not be empty",
      }),
    );
  }

  return success(normalizedValue);
}

export function validateJobId(value: number): GreenhouseResult<number> {
  if (!isPositiveInteger(value)) {
    return failure(
      createInputError({
        field: "jobId",
        message: "Job ID must be a positive integer",
      }),
    );
  }

  return success(value);
}

export function validateBoardResponse(value: unknown, url: string): GreenhouseResult<GreenhouseBoard> {
  if (!isRecord(value)) {
    return failure(createValidationError({ url, details: "Board response must be an object" }));
  }

  const name = value["name"];
  const content = value["content"];

  if (typeof name !== "string") {
    return failure(createValidationError({ url, details: "Board name must be a string" }));
  }

  if (typeof content !== "string") {
    return failure(createValidationError({ url, details: "Board content must be a string" }));
  }

  return success({ name, content });
}

export function validateJobResponse(value: unknown, url: string): GreenhouseResult<GreenhouseJob> {
  if (!isGreenhouseJob(value)) {
    return failure(createValidationError({ url, details: "Job response has an invalid shape" }));
  }

  return success(value);
}

export function validateJobsResponse(value: unknown, url: string): GreenhouseResult<GreenhouseJobsResponse> {
  if (!isRecord(value)) {
    return failure(createValidationError({ url, details: "Jobs response must be an object" }));
  }

  const jobs = value["jobs"];
  const meta = value["meta"];

  if (!isGreenhouseJobArray(jobs)) {
    return failure(createValidationError({ url, details: "Jobs must be an array of valid job objects" }));
  }

  if (!isGreenhouseJobsMeta(meta)) {
    return failure(createValidationError({ url, details: "Jobs metadata is invalid" }));
  }

  if (jobs.length !== meta.total) {
    return failure(
      createValidationError({
        url,
        details: `Jobs response is incomplete: expected ${meta.total} jobs but received ${jobs.length}`,
      }),
    );
  }

  if (hasDuplicateJobIds(jobs)) {
    return failure(createValidationError({ url, details: "Jobs response contains duplicate job IDs" }));
  }

  return success({ jobs, meta });
}

function isGreenhouseJobArray(value: unknown): value is readonly GreenhouseJob[] {
  return Array.isArray(value) && value.every(isGreenhouseJob);
}

function isGreenhouseJobsMeta(value: unknown): value is GreenhouseJobsMeta {
  if (!isRecord(value)) {
    return false;
  }

  return isNonNegativeInteger(value["total"]);
}

function hasDuplicateJobIds(jobs: readonly GreenhouseJob[]): boolean {
  const uniqueJobIds = new Set(jobs.map((job) => job.id));
  return uniqueJobIds.size !== jobs.length;
}

function isGreenhouseJob(value: unknown): value is GreenhouseJob {
  if (!isRecord(value)) {
    return false;
  }

  if (!hasJobIdentityFields(value)) {
    return false;
  }

  if (!hasJobMetadataFields(value)) {
    return false;
  }

  return hasOptionalJobFields(value);
}

function hasJobIdentityFields(value: Record<string, unknown>): boolean {
  const location = value["location"];

  return (
    isPositiveInteger(value["id"]) &&
    isPositiveInteger(value["internal_job_id"]) &&
    typeof value["title"] === "string" &&
    isAbsoluteUrl(value["absolute_url"]) &&
    typeof value["company_name"] === "string" &&
    isRecord(location) &&
    typeof location["name"] === "string"
  );
}

function hasJobMetadataFields(value: Record<string, unknown>): boolean {
  return (
    typeof value["updated_at"] === "string" &&
    typeof value["first_published"] === "string" &&
    typeof value["language"] === "string" &&
    isNullableString(value["requisition_id"]) &&
    isNullableString(value["application_deadline"]) &&
    isGreenhouseMetadataArray(value["metadata"]) &&
    isGreenhouseDataComplianceArray(value["data_compliance"])
  );
}

function hasOptionalJobFields(value: Record<string, unknown>): boolean {
  return (
    isOptionalString(value["content"]) &&
    isOptionalArrayOf(value["departments"], isGreenhouseDepartment) &&
    isOptionalArrayOf(value["offices"], isGreenhouseOffice) &&
    isOptionalNullableString(value["ai_disclaimer"]) &&
    isOptionalBoolean(value["include_ai_disclaimer"]) &&
    isOptionalNullableString(value["ai_opt_out_request_url"])
  );
}

function isGreenhouseMetadataArray(value: unknown): value is readonly GreenhouseMetadata[] {
  return Array.isArray(value) && value.every(isGreenhouseMetadata);
}

function isGreenhouseMetadata(value: unknown): value is GreenhouseMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value["id"]) &&
    typeof value["name"] === "string" &&
    isGreenhouseMetadataValue(value["value"]) &&
    typeof value["value_type"] === "string"
  );
}

function isGreenhouseMetadataValue(value: unknown): value is GreenhouseMetadataValue {
  if (value === null) {
    return true;
  }

  if (typeof value === "string") {
    return true;
  }

  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isGreenhouseDataComplianceArray(value: unknown): value is readonly GreenhouseDataCompliance[] {
  return Array.isArray(value) && value.every(isGreenhouseDataCompliance);
}

function isGreenhouseDataCompliance(value: unknown): value is GreenhouseDataCompliance {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value["type"] === "string" &&
    typeof value["requires_consent"] === "boolean" &&
    typeof value["requires_processing_consent"] === "boolean" &&
    typeof value["requires_retention_consent"] === "boolean" &&
    isNullableNumber(value["retention_period"]) &&
    isOptionalBoolean(value["demographic_data_consent_applies"])
  );
}

function isGreenhouseDepartment(value: unknown): value is GreenhouseDepartment {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value["id"]) &&
    typeof value["name"] === "string" &&
    isPositiveIntegerArray(value["child_ids"]) &&
    isNullablePositiveInteger(value["parent_id"])
  );
}

function isGreenhouseOffice(value: unknown): value is GreenhouseOffice {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveInteger(value["id"]) &&
    typeof value["name"] === "string" &&
    isNullableString(value["location"]) &&
    isPositiveIntegerArray(value["child_ids"]) &&
    isNullablePositiveInteger(value["parent_id"])
  );
}

function isOptionalArrayOf<T>(
  value: unknown,
  predicate: (item: unknown) => item is T,
): value is readonly T[] | undefined {
  if (value === undefined) {
    return true;
  }

  return Array.isArray(value) && value.every(predicate);
}

function isPositiveIntegerArray(value: unknown): value is readonly number[] {
  return Array.isArray(value) && value.every(isPositiveInteger);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNullableString(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNullablePositiveInteger(value: unknown): value is number | null {
  return value === null || isPositiveInteger(value);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isAbsoluteUrl(value: unknown): value is string {
  if (typeof value !== "string" || !URL.canParse(value)) {
    return false;
  }

  const parsedUrl = new URL(value);
  return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
