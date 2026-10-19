import type { BoardConfig } from "#src/modules/collect-jobs/index.js";
import { DISCORD_BOARDS } from "#src/modules/collect-jobs/index.js";
import type { StoredJob, TrackerState } from "#src/modules/build-state/index.js";

export interface AddedJob {
  readonly board: BoardConfig;
  readonly job: StoredJob;
}

export interface RemovedJob {
  readonly board: BoardConfig;
  readonly job: StoredJob;
}

export interface FieldChange {
  readonly path: string;
  readonly oldValue: unknown;
  readonly newValue: unknown;
}

export interface EditedJob {
  readonly board: BoardConfig;
  readonly job: StoredJob;
  readonly changes: readonly FieldChange[];
}

export interface JobDiffs {
  readonly added: readonly AddedJob[];
  readonly removed: readonly RemovedJob[];
  readonly edited: readonly EditedJob[];
}

const boardConfigByToken = new Map<string, BoardConfig>(
  DISCORD_BOARDS.map((board) => [board.token, board]),
);

export function isJobDiffs(value: unknown): value is JobDiffs {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value["added"]) &&
    value["added"].every(isJobChangeEntry) &&
    Array.isArray(value["removed"]) &&
    value["removed"].every(isJobChangeEntry) &&
    Array.isArray(value["edited"]) &&
    value["edited"].every(isEditedJobEntry)
  );
}

export function findAddedJobs(
  oldState: TrackerState | null,
  newState: TrackerState,
): readonly AddedJob[] {
  if (oldState === null) {
    return [];
  }

  const added: AddedJob[] = [];

  for (const [boardToken, newBoard] of Object.entries(newState.boards)) {
    const oldBoard = oldState.boards[boardToken];

    if (oldBoard === undefined) {
      continue;
    }

    const oldJobIds = new Set(oldBoard.jobs.map((job) => job.id));

    for (const job of newBoard.jobs) {
      if (!oldJobIds.has(job.id)) {
        added.push({ board: resolveBoard(boardToken), job });
      }
    }
  }

  return added;
}

export function findEditedJobs(
  oldState: TrackerState | null,
  newState: TrackerState,
): readonly EditedJob[] {
  if (oldState === null) {
    return [];
  }

  const edited: EditedJob[] = [];

  for (const [boardToken, newBoard] of Object.entries(newState.boards)) {
    const oldBoard = oldState.boards[boardToken];

    if (oldBoard === undefined) {
      continue;
    }

    const oldJobsById = new Map(oldBoard.jobs.map((job) => [job.id, job]));

    for (const job of newBoard.jobs) {
      const oldJob = oldJobsById.get(job.id);

      if (oldJob === undefined) {
        continue;
      }

      const changes = diffValues(oldJob, job, "");

      if (changes.length > 0) {
        edited.push({ board: resolveBoard(boardToken), job, changes });
      }
    }
  }

  return edited;
}

export function findRemovedJobs(
  oldState: TrackerState | null,
  newState: TrackerState,
): readonly RemovedJob[] {
  if (oldState === null) {
    return [];
  }

  const removed: RemovedJob[] = [];

  for (const [boardToken, newBoard] of Object.entries(newState.boards)) {
    const oldBoard = oldState.boards[boardToken];

    if (oldBoard === undefined) {
      continue;
    }

    const newJobIds = new Set(newBoard.jobs.map((job) => job.id));

    for (const job of oldBoard.jobs) {
      if (!newJobIds.has(job.id)) {
        removed.push({ board: resolveBoard(boardToken), job });
      }
    }
  }

  return removed;
}

function diffValues(before: unknown, after: unknown, path: string): FieldChange[] {
  const normalizedBefore = before === undefined ? null : before;
  const normalizedAfter = after === undefined ? null : after;

  if (Object.is(normalizedBefore, normalizedAfter)) {
    return [];
  }

  if (Array.isArray(normalizedBefore) && Array.isArray(normalizedAfter)) {
    return diffArrays(normalizedBefore, normalizedAfter, path);
  }

  if (isRecord(normalizedBefore) && isRecord(normalizedAfter)) {
    return diffObjects(normalizedBefore, normalizedAfter, path);
  }

  return [{ path, oldValue: normalizedBefore, newValue: normalizedAfter }];
}

function diffArrays(before: readonly unknown[], after: readonly unknown[], path: string): FieldChange[] {
  const changes: FieldChange[] = [];
  const length = Math.max(before.length, after.length);

  for (let index = 0; index < length; index += 1) {
    changes.push(...diffValues(before[index], after[index], `${path}[${index}]`));
  }

  return changes;
}

function diffObjects(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  path: string,
): FieldChange[] {
  const changes: FieldChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of [...keys].sort()) {
    changes.push(...diffValues(before[key], after[key], path === "" ? key : `${path}.${key}`));
  }

  return changes;
}

function isEditedJobEntry(value: unknown): value is EditedJob {
  if (!isRecord(value)) {
    return false;
  }

  const board = value["board"];
  const job = value["job"];
  const changes = value["changes"];

  return (
    isRecord(board) &&
    typeof board["token"] === "string" &&
    typeof board["label"] === "string" &&
    isRecord(job) &&
    Array.isArray(changes) &&
    changes.every(isFieldChange)
  );
}

function isFieldChange(value: unknown): value is FieldChange {
  return (
    isRecord(value) &&
    typeof value["path"] === "string" &&
    "oldValue" in value &&
    "newValue" in value
  );
}

function isJobChangeEntry(value: unknown): value is AddedJob | RemovedJob {
  if (!isRecord(value)) {
    return false;
  }

  const board = value["board"];
  const job = value["job"];

  return (
    isRecord(board) &&
    typeof board["token"] === "string" &&
    typeof board["label"] === "string" &&
    isRecord(job)
  );
}

function resolveBoard(token: string): BoardConfig {
  return boardConfigByToken.get(token) ?? { token, label: token };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
