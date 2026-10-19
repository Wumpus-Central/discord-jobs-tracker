import { Pipeline } from "#src/pipeline.js";
import { parseSteps } from "#src/utils/args.js";

const pipeline = new Pipeline();
// TODO: register steps, e.g. pipeline.step("example", exampleStep);

await pipeline.run(parseSteps(process.argv));
