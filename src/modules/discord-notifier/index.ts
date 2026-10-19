import { setTimeout as delay } from "node:timers/promises";

import { logger } from "#src/logger.js";
import type { StepHandler } from "#src/pipeline.js";
import { executeWebhook } from "#src/modules/discord/index.js";
import { isJobDiffs } from "#src/modules/diff-jobs/index.js";
import { createAddedJobEmbed, createEditedJobEmbed, createRemovedJobEmbed } from "./format.js";

const MAX_EMBEDS_PER_MESSAGE = 10;
const MESSAGE_DELAY_MS = 500;

const log = logger.child({ module: "discord-notifier" });

export const discordNotifier: StepHandler = async (ctx) => {
  const jobDiffs = ctx.state["jobDiffs"];

  if (!isJobDiffs(jobDiffs)) {
    throw new Error("diff-jobs did not produce valid job diffs");
  }

  const embeds = [
    ...jobDiffs.added.map(createAddedJobEmbed),
    ...jobDiffs.removed.map(createRemovedJobEmbed),
    ...jobDiffs.edited.map(createEditedJobEmbed),
  ];

  if (embeds.length === 0) {
    log.info("No job changes, skipping notification");
    return ctx;
  }

  const chunks = chunk(embeds, MAX_EMBEDS_PER_MESSAGE);

  for (const [index, messageEmbeds] of chunks.entries()) {
    if (index > 0) {
      await delay(MESSAGE_DELAY_MS);
    }

    await executeWebhook({ embeds: messageEmbeds });
  }

  log.info(
    {
      added: jobDiffs.added.length,
      removed: jobDiffs.removed.length,
      edited: jobDiffs.edited.length,
      messages: chunks.length,
    },
    "Job notifications sent",
  );

  return ctx;
};

function chunk<T>(items: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}
