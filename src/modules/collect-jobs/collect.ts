import { logger } from "#src/logger.js";
import type {
  GreenhouseClient,
  GreenhouseError,
  GreenhouseJob,
} from "#src/modules/greenhouse/index.js";
import type { BoardConfig } from "./boards.js";

const log = logger.child({ module: "collect-jobs" });

export interface BoardFetchSuccess {
  readonly kind: "success";
  readonly board: BoardConfig;
  readonly jobs: readonly GreenhouseJob[];
}

export interface BoardFetchFailure {
  readonly kind: "failure";
  readonly board: BoardConfig;
  readonly error: GreenhouseError;
}

export type BoardFetchResult = BoardFetchSuccess | BoardFetchFailure;

/**
 * Fetches every board concurrently. Expected API failures are returned per board
 * so a single unavailable board never becomes an empty job list.
 */
export async function collectBoards(
  boards: readonly BoardConfig[],
  client: Pick<GreenhouseClient, "getJobs">,
): Promise<readonly BoardFetchResult[]> {
  if (boards.length === 0) {
    throw new Error("At least one board must be configured");
  }

  log.info({ boards: boards.length }, "Collecting Greenhouse boards");

  const results = await Promise.all(
    boards.map(async (board): Promise<BoardFetchResult> => {
      const startedAt = Date.now();
      const result = await client.getJobs(board.token);
      const tookMs = Date.now() - startedAt;

      if (!result.success) {
        log.error(
          { ...result.error, board: board.token, label: board.label, tookMs },
          "Board fetch failed",
        );

        return { kind: "failure", board, error: result.error };
      }

      log.info(
        {
          board: board.token,
          label: board.label,
          jobs: result.data.jobs.length,
          tookMs,
        },
        "Board fetched",
      );

      return { kind: "success", board, jobs: result.data.jobs };
    }),
  );

  const successfulResults = results.filter(
    (result): result is BoardFetchSuccess => result.kind === "success",
  );
  const jobCount = successfulResults.reduce((total, result) => total + result.jobs.length, 0);

  log.info(
    {
      boards: results.length,
      succeeded: successfulResults.length,
      failed: results.length - successfulResults.length,
      jobs: jobCount,
    },
    "Board collection completed",
  );

  return results;
}
