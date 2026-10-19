import { greenhouse } from "#src/modules/greenhouse/index.js";
import type { StepHandler } from "#src/pipeline.js";
import { DISCORD_BOARDS } from "./boards.js";
import { collectBoards } from "./collect.js";

export type { BoardConfig } from "./boards.js";
export type { BoardFetchFailure, BoardFetchResult, BoardFetchSuccess } from "./collect.js";

export const collectJobs: StepHandler = async (ctx) => {
  const boardResults = await collectBoards(DISCORD_BOARDS, greenhouse);

  if (boardResults.every((result) => result.kind === "failure")) {
    throw new Error("Failed to collect every Greenhouse board");
  }

  return {
    ...ctx,
    state: {
      ...ctx.state,
      boardResults,
    },
  };
};
