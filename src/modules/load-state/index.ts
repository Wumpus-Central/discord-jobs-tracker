import { logger } from "#src/logger.js";
import type { StepHandler } from "#src/pipeline.js";
import { readGistFile } from "#src/modules/opengist/index.js";

const log = logger.child({ module: "load-state" });

export const loadState: StepHandler = async (ctx) => {
  const file = await readGistFile("state.json");

  if (file === null) {
    log.info("No previous state found, starting with an empty state");
    return { ...ctx, state: { ...ctx.state, oldState: null } };
  }

  if (file.truncated) {
    throw new Error("state.json is truncated in Opengist");
  }

  let oldState: unknown;

  try {
    oldState = JSON.parse(file.content);
  } catch (error) {
    throw new Error("state.json is not valid JSON", { cause: error });
  }

  log.info({ size: file.size }, "Previous state loaded");
  return { ...ctx, state: { ...ctx.state, oldState } };
};
