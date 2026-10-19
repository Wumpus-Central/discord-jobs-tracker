import { isDeepStrictEqual } from "node:util";

import { logger } from "#src/logger.js";
import type { StepHandler } from "#src/pipeline.js";
import { saveGist } from "#src/modules/opengist/index.js";

const log = logger.child({ module: "save-state" });

export const saveState: StepHandler = async (ctx) => {
  const newState = ctx.state["newState"];

  if (newState === undefined) {
    log.warn("No new state in pipeline context, skipping save");
    return ctx;
  }

  const oldState = ctx.state["oldState"];

  if (oldState !== undefined && isDeepStrictEqual(oldState, newState)) {
    log.info("State unchanged, skipping save");
    return ctx;
  }

  await saveGist("state.json", newState);
  log.info("State saved to Opengist");
  return ctx;
};
