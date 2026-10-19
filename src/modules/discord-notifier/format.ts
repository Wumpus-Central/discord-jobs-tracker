import type { StoredJob } from "#src/modules/build-state/index.js";
import type { AddedJob, EditedJob, FieldChange, RemovedJob } from "#src/modules/diff-jobs/index.js";
import { EmbedBuilder } from "#src/modules/discord/index.js";
import type { Embed } from "#src/modules/discord/index.js";

const COLOR_ADDED = 0x57f287;
const COLOR_REMOVED = 0xed4245;
const COLOR_EDITED = 0xfee75c;

const MAX_CHANGES_PER_JOB = 6;
const MAX_CHANGE_VALUE_CHARS = 160;

export function createAddedJobEmbed(entry: AddedJob): Embed {
  return createJobEmbed(entry.job, entry.board.label, COLOR_ADDED);
}

export function createRemovedJobEmbed(entry: RemovedJob): Embed {
  return createJobEmbed(entry.job, entry.board.label, COLOR_REMOVED);
}

export function createEditedJobEmbed(entry: EditedJob): Embed {
  return createJobEmbed(entry.job, entry.board.label, COLOR_EDITED, formatChanges(entry.changes));
}

function createJobEmbed(
  job: StoredJob,
  boardLabel: string,
  color: number,
  details?: string,
): Embed {
  const description = getJobDescription(job);
  const fullDescription = details === undefined ? description : `${description}\n\n${details}`;

  return new EmbedBuilder()
    .title(job.title)
    .url(job.absolute_url)
    .color(color)
    .description(fullDescription)
    .footer(`Board: ${boardLabel}`)
    .build();
}

function getJobDescription(job: StoredJob): string {
  const department = getDepartment(job);
  const office = getOffice(job);

  return [
    department === null ? null : `**Department:** ${department}`,
    `**Location:** ${job.location.name}`,
    office === null ? null : `**Office:** ${office}`,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function formatChanges(changes: readonly FieldChange[]): string {
  const visibleChanges = changes.slice(0, MAX_CHANGES_PER_JOB);
  const hiddenCount = changes.length - visibleChanges.length;
  const lines: string[] = [];

  for (const change of visibleChanges) {
    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(
      change.path,
      `- ${formatValue(change.oldValue)}`,
      `+ ${formatValue(change.newValue)}`,
    );
  }

  if (hiddenCount > 0) {
    if (lines.length > 0) {
      lines.push("");
    }

    lines.push(`…and ${hiddenCount} more changes`);
  }

  return ["**Changes**", "```diff", ...lines, "```"].join("\n");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "(none)";
  }

  const normalizedText =
    typeof value === "string"
      ? value.replace(/\s+/g, " ").trim()
      : JSON.stringify(value) ?? String(value);

  return normalizedText.length <= MAX_CHANGE_VALUE_CHARS
    ? normalizedText
    : `${normalizedText.slice(0, MAX_CHANGE_VALUE_CHARS - 1)}…`;
}

function getDepartment(job: StoredJob): string | null {
  const department = job.departments?.[0]?.name;

  if (department !== undefined) {
    return department;
  }

  const metadata = job.metadata.find((entry) => entry.name === "Careers Site Department");
  return typeof metadata?.value === "string" ? metadata.value : null;
}

function getOffice(job: StoredJob): string | null {
  const office = job.offices?.[0]?.name;

  if (office === undefined) {
    return null;
  }

  return normalizeLocation(office) === normalizeLocation(job.location.name) ? null : office;
}

function normalizeLocation(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
