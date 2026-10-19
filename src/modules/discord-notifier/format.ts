import type { StoredJob } from "#src/modules/build-state/index.js";
import type { AddedJob, RemovedJob } from "#src/modules/diff-jobs/index.js";
import { EmbedBuilder } from "#src/modules/discord/index.js";
import type { Embed } from "#src/modules/discord/index.js";

const COLOR_ADDED = 0x57f287;
const COLOR_REMOVED = 0xed4245;

export function createAddedJobEmbed(entry: AddedJob): Embed {
  return createJobEmbed(entry.job, entry.board.label, COLOR_ADDED);
}

export function createRemovedJobEmbed(entry: RemovedJob): Embed {
  return createJobEmbed(entry.job, entry.board.label, COLOR_REMOVED);
}

function createJobEmbed(job: StoredJob, boardLabel: string, color: number): Embed {
  const department = getDepartment(job);
  const office = getOffice(job);
  const description = [
    department === null ? null : `**Department:** ${department}`,
    `**Location:** ${job.location.name}`,
    office === null ? null : `**Office:** ${office}`,
  ].filter((line): line is string => line !== null);

  return new EmbedBuilder()
    .title(job.title)
    .url(job.absolute_url)
    .color(color)
    .description(description.join("\n"))
    .footer(`Board: ${boardLabel}`)
    .build();
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
