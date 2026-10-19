import { logger } from "#src/logger.js";
import { getGist, updateGist } from "./endpoints/index.js";

const log = logger.child({ module: "opengist" });

function getGistId(): string {
  const gistId = process.env["OPENGIST_GIST_ID"];
  if (!gistId) {
    throw new Error("OPENGIST_GIST_ID is not set");
  }

  return gistId;
}

export interface GistFileContent {
  readonly content: string;
  readonly size: number;
  readonly truncated: boolean;
}

/** Reads a raw gist file without parsing it. Returns `null` when the file does not exist. */
export async function readGistFile(filename: string): Promise<GistFileContent | null> {
  const gistId = getGistId();

  log.info({ filename }, "Reading file from Opengist");

  const gist = await getGist(gistId);
  const file = gist.files[filename];

  if (!file) {
    log.warn({ filename }, "File not found in Opengist");
    return null;
  }

  log.info({ filename, size: file.size, truncated: file.truncated }, "File read successfully");
  return {
    content: file.content,
    size: file.size,
    truncated: file.truncated,
  };
}

export async function saveGist(filename: string, value: unknown): Promise<void> {
  const gistId = getGistId();

  log.info({ filename }, "Writing file to Opengist");

  await updateGist(gistId, {
    files: {
      [filename]: {
        content: JSON.stringify(value, null, 2),
      },
    },
  });

  log.info({ filename }, "File written successfully");
}
