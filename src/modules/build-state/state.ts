import type { BoardFetchResult } from "#src/modules/collect-jobs/index.js";
import type { GreenhouseJob } from "#src/modules/greenhouse/index.js";

export type StoredJob = Omit<GreenhouseJob, "content" | "updated_at">;

export interface BoardSnapshot {
  readonly jobs: readonly StoredJob[];
}

export interface TrackerState {
  readonly schemaVersion: 1;
  readonly boards: Readonly<Record<string, BoardSnapshot>>;
}

export function buildTrackerState(
  oldState: TrackerState | null,
  boardResults: readonly BoardFetchResult[],
): TrackerState {
  const boards: Record<string, BoardSnapshot> = {};

  for (const result of boardResults) {
    if (result.kind === "failure") {
      const previousBoard = oldState?.boards[result.board.token];

      if (previousBoard !== undefined) {
        boards[result.board.token] = previousBoard;
      }

      continue;
    }

    boards[result.board.token] = {
      jobs: result.jobs.map(toStoredJob).sort((left, right) => left.id - right.id),
    };
  }

  return { schemaVersion: 1, boards };
}

export function isBoardFetchResultArray(value: unknown): value is readonly BoardFetchResult[] {
  return Array.isArray(value) && value.every(isBoardFetchResult);
}

export function isTrackerState(value: unknown): value is TrackerState {
  if (!isRecord(value) || value["schemaVersion"] !== 1) {
    return false;
  }

  const boards = value["boards"];
  return isRecord(boards) && Object.values(boards).every(isBoardSnapshot);
}

function toStoredJob(job: GreenhouseJob): StoredJob {
  // Destructured only to omit HTML content and the bulk-refreshed timestamp.
  const { content, updated_at, ...storedJob } = job;
  void content;
  void updated_at;
  return storedJob;
}

function isBoardFetchResult(value: unknown): value is BoardFetchResult {
  if (!isRecord(value) || !isBoardConfig(value["board"])) {
    return false;
  }

  if (value["kind"] === "success") {
    return Array.isArray(value["jobs"]);
  }

  if (value["kind"] === "failure") {
    return isRecord(value["error"]);
  }

  return false;
}

function isBoardConfig(value: unknown): value is BoardFetchResult["board"] {
  return isRecord(value) && typeof value["token"] === "string" && typeof value["label"] === "string";
}

function isBoardSnapshot(value: unknown): value is BoardSnapshot {
  if (!isRecord(value)) {
    return false;
  }

  const jobs = value["jobs"];
  return Array.isArray(jobs) && jobs.every(isStoredJob);
}

function isStoredJob(value: unknown): value is StoredJob {
  if (!isRecord(value)) {
    return false;
  }

  const location = value["location"];

  return (
    isPositiveInteger(value["id"]) &&
    typeof value["title"] === "string" &&
    typeof value["absolute_url"] === "string" &&
    typeof value["company_name"] === "string" &&
    isRecord(location) &&
    typeof location["name"] === "string"
  );
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
