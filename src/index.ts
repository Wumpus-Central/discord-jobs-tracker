import { Pipeline } from "#src/pipeline.js";
import { collectJobs } from "#src/modules/collect-jobs/index.js";
import { parseSteps } from "#src/utils/args.js";

const pipeline = new Pipeline().step("collect-jobs", collectJobs);

await pipeline.run(parseSteps(process.argv));
