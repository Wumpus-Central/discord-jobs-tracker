export interface BoardConfig {
  readonly token: string;
  readonly label: string;
}

/**
 * Greenhouse boards tracked by the job collector.
 * `internationaleor` is an EOR partner board, not an official Discord board.
 */
export const DISCORD_BOARDS = [
  { token: "discord", label: "Discord" },
  { token: "discordinternational", label: "Discord International" },
  { token: "internationaleor", label: "International EOR" },
] as const satisfies readonly BoardConfig[];
