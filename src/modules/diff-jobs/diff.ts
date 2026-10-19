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

export interface JobDiffs {
  readonly added: readonly AddedJob[];
  readonly removed: readonly RemovedJob[];
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
    value["removed"].every(isJobChangeEntry)
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
