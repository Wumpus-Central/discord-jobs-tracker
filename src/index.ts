import { Pipeline } from "#src/pipeline.js";
import { loadState } from "#src/modules/load-state/index.js";
import { collectJobs } from "#src/modules/collect-jobs/index.js";
import { buildState } from "#src/modules/build-state/index.js";
import { diffJobs } from "#src/modules/diff-jobs/index.js";
import { discordNotifier } from "#src/modules/discord-notifier/index.js";
import { saveState } from "#src/modules/save-state/index.js";
import { parseSteps } from "#src/utils/args.js";

const pipeline = new Pipeline()
  .step("load-state", loadState)
  .step("collect-jobs", collectJobs)
  .step("build-state", buildState)
  .step("diff-jobs", diffJobs)
  .step("discord-notifier", discordNotifier)
  .step("save-state", saveState);

await pipeline.run(parseSteps(process.argv));
