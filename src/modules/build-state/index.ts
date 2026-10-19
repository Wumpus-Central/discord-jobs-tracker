import { logger } from "#src/logger.js";
import type { StepHandler } from "#src/pipeline.js";
import {
  buildTrackerState,
  isBoardFetchResultArray,
  isTrackerState,
  type TrackerState,
} from "./state.js";

const log = logger.child({ module: "build-state" });

export type { BoardSnapshot, StoredJob, TrackerState } from "./state.js";

export const buildState: StepHandler = async (ctx) => {
  const boardResults = ctx.state["boardResults"];

  if (!isBoardFetchResultArray(boardResults)) {
    throw new Error("collect-jobs did not produce valid board results");
  }

  const oldStateValue = ctx.state["oldState"];
  let oldState: TrackerState | null;

  if (oldStateValue === undefined || oldStateValue === null) {
    oldState = null;
  } else if (isTrackerState(oldStateValue)) {
    oldState = oldStateValue;
  } else {
    throw new Error("Previous state has an invalid schema");
  }

  const newState = buildTrackerState(oldState, boardResults);
  const jobCount = Object.values(newState.boards).reduce(
    (total, board) => total + board.jobs.length,
    0,
  );

  log.info({ boards: Object.keys(newState.boards).length, jobs: jobCount }, "State built");

  return { ...ctx, state: { ...ctx.state, newState } };
};
