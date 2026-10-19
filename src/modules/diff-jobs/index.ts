import { logger } from "#src/logger.js";
import type { StepHandler } from "#src/pipeline.js";
import { isTrackerState } from "#src/modules/build-state/index.js";
import type { TrackerState } from "#src/modules/build-state/index.js";
import { findAddedJobs, findRemovedJobs, type JobDiffs } from "./diff.js";

const log = logger.child({ module: "diff-jobs" });

export { isJobDiffs } from "./diff.js";
export type { AddedJob, JobDiffs, RemovedJob } from "./diff.js";

export const diffJobs: StepHandler = async (ctx) => {
  const newStateValue = ctx.state["newState"];

  if (!isTrackerState(newStateValue)) {
    throw new Error("build-state did not produce a valid new state");
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

  const jobDiffs: JobDiffs = {
    added: findAddedJobs(oldState, newStateValue),
    removed: findRemovedJobs(oldState, newStateValue),
  };

  log.info(
    { added: jobDiffs.added.length, removed: jobDiffs.removed.length },
    oldState === null ? "Bootstrap diff completed" : "Job diff completed",
  );

  return { ...ctx, state: { ...ctx.state, jobDiffs } };
};
