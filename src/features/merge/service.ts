import { randomUUID } from "node:crypto";

import { maybeGenerateLifeSummary } from "@/features/ai/service";
import {
  listCompletedWorkEntriesByDate,
  listLifeEntriesByDate,
  parseTags,
  type EntryRecord,
} from "@/features/diary/service";
import { ensureProfileSettings } from "@/features/settings/service";
import {
  DEFAULT_PROFILE_ID,
  ENTRY_MODULE,
  GENERATOR_MODE,
  type EntryModule,
} from "@/lib/constants";
import { db, nowIso, type DatabaseClient } from "@/lib/db";
import { hashValue } from "@/lib/hash";
import { parseJson, toJsonString } from "@/lib/json";
import { chineseDateLabel, formatLocalTime } from "@/lib/time";

export interface DailyRecord {
  id: string;
  profileId: number;
  module: "life" | "work";
  recordDate: string;
  contentMarkdown: string;
  contentJson: string;
  sourceIdsJson: string;
  sourceHash: string;
  generatorMode: "rule" | "ai";
  generatedAt: string;
  updatedAt: string;
}

export interface LifeRecordContent {
  title: string;
  summary?: string;
  items: Array<{
    id: string;
    time: string;
    content: string;
    mood?: string | null;
    tags: string[];
  }>;
}

export interface WorkRecordContent {
  title: string;
  items: Array<{
    id: string;
    time: string;
    title: string;
    description: string;
  }>;
}

function mapDailyRecord(row: {
  id: string;
  profile_id: number;
  module: "life" | "work";
  record_date: string;
  content_markdown: string;
  content_json: string;
  source_ids_json: string;
  source_hash: string;
  generator_mode: "rule" | "ai";
  generated_at: string;
  updated_at: string;
}): DailyRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    module: row.module,
    recordDate: row.record_date,
    contentMarkdown: row.content_markdown,
    contentJson: row.content_json,
    sourceIdsJson: row.source_ids_json,
    sourceHash: row.source_hash,
    generatorMode: row.generator_mode,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at,
  };
}

export function buildLifeDailyContent(
  dateKey: string,
  entries: EntryRecord[],
  summary?: string | null,
  timezone?: string,
): { markdown: string; content: LifeRecordContent } {
  const label = chineseDateLabel(dateKey);
  const items = entries.map((entry) => ({
    id: entry.id,
    time: formatLocalTime(new Date(entry.occurredAt), timezone),
    content: entry.content,
    mood: entry.mood,
    tags: parseTags(entry.tagsJson),
  }));

  const lines = [
    `# 生活日报 · ${label}`,
    "",
    ...(summary ? [summary, ""] : []),
    ...(items.length
      ? items.map((item) => {
          const suffix = [
            item.mood ? `心情：${item.mood}` : null,
            item.tags.length ? `标签：${item.tags.join(" / ")}` : null,
          ]
            .filter(Boolean)
            .join("，");

          return `- ${item.time} ${item.content}${suffix ? `（${suffix}）` : ""}`;
        })
      : ["- 今天还没有生活记录。"]),
  ];

  return {
    markdown: lines.join("\n"),
    content: {
      title: `生活日报 · ${label}`,
      summary: summary ?? undefined,
      items,
    },
  };
}

export function buildWorkDailyContent(
  dateKey: string,
  entries: EntryRecord[],
  timezone?: string,
): { markdown: string; content: WorkRecordContent } {
  const label = chineseDateLabel(dateKey);
  const items = entries.map((entry) => ({
    id: entry.id,
    time: entry.completedAt
      ? formatLocalTime(new Date(entry.completedAt), timezone)
      : "--:--",
    title: entry.title || "未命名任务",
    description: entry.content,
  }));

  const lines = [
    `# 工作日报 · ${label}`,
    "",
    ...(items.length
      ? items.map(
          (item) =>
            `- ${item.time} ${item.title}${
              item.description ? `：${item.description}` : ""
            }`,
        )
      : ["- 今天没有已完成的工作任务。"]),
  ];

  return {
    markdown: lines.join("\n"),
    content: {
      title: `工作日报 · ${label}`,
      items,
    },
  };
}

export async function getDailyRecordByDate(
  recordDate: string,
  module: EntryModule,
  client: DatabaseClient = db,
): Promise<DailyRecord | null> {
  const row = client.get<{
    id: string;
    profile_id: number;
    module: "life" | "work";
    record_date: string;
    content_markdown: string;
    content_json: string;
    source_ids_json: string;
    source_hash: string;
    generator_mode: "rule" | "ai";
    generated_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM daily_records
      WHERE profile_id = ? AND module = ? AND record_date = ?
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID, module, recordDate],
  );

  return row ? mapDailyRecord(row) : null;
}

export async function generateDailyRecord(
  recordDate: string,
  module: EntryModule,
  client: DatabaseClient = db,
): Promise<DailyRecord> {
  const profile = await ensureProfileSettings(client);
  const now = nowIso();

  if (module === ENTRY_MODULE.LIFE) {
    const entries = await listLifeEntriesByDate(recordDate, client);
    const inputHash = hashValue({
      module,
      recordDate,
      aiEnabled: profile.aiEnabled,
      source: entries.map((entry) => [entry.id, entry.updatedAt]),
    });
    const existing = await getDailyRecordByDate(recordDate, module, client);

    if (existing?.sourceHash === inputHash) {
      return existing;
    }

    const summaryInput = entries
      .map(
        (entry) =>
          `${formatLocalTime(new Date(entry.occurredAt), profile.timezone)} ${entry.content}`,
      )
      .join("\n");
    const aiSummary = await maybeGenerateLifeSummary(
      profile.aiEnabled,
      summaryInput,
    );
    const built = buildLifeDailyContent(
      recordDate,
      entries,
      aiSummary,
      profile.timezone,
    );
    if (existing) {
      client.run(
        `
          UPDATE daily_records
          SET content_markdown = ?, content_json = ?, source_ids_json = ?, source_hash = ?, generator_mode = ?, generated_at = ?, updated_at = ?
          WHERE id = ?
        `,
        [
          built.markdown,
          toJsonString(built.content),
          toJsonString(entries.map((entry) => entry.id)),
          inputHash,
          aiSummary ? GENERATOR_MODE.AI : GENERATOR_MODE.RULE,
          now,
          now,
          existing.id,
        ],
      );

      return (await getDailyRecordByDate(recordDate, module, client))!;
    }

    const id = randomUUID();
    client.run(
      `
        INSERT INTO daily_records (
          id,
          profile_id,
          module,
          record_date,
          content_markdown,
          content_json,
          source_ids_json,
          source_hash,
          generator_mode,
          generated_at,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        profile.id,
        module,
        recordDate,
        built.markdown,
        toJsonString(built.content),
        toJsonString(entries.map((entry) => entry.id)),
        inputHash,
        aiSummary ? GENERATOR_MODE.AI : GENERATOR_MODE.RULE,
        now,
        now,
        now,
      ],
    );

    return (await getDailyRecordByDate(recordDate, module, client))!;
  }

  const entries = await listCompletedWorkEntriesByDate(recordDate, client);
  const inputHash = hashValue({
    module,
    recordDate,
    source: entries.map((entry) => [entry.id, entry.updatedAt]),
  });
  const existing = await getDailyRecordByDate(recordDate, module, client);

  if (existing?.sourceHash === inputHash) {
    return existing;
  }

  const built = buildWorkDailyContent(recordDate, entries, profile.timezone);

  if (existing) {
    client.run(
      `
        UPDATE daily_records
        SET content_markdown = ?, content_json = ?, source_ids_json = ?, source_hash = ?, generator_mode = ?, generated_at = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        built.markdown,
        toJsonString(built.content),
        toJsonString(entries.map((entry) => entry.id)),
        inputHash,
        GENERATOR_MODE.RULE,
        now,
        now,
        existing.id,
      ],
    );

    return (await getDailyRecordByDate(recordDate, module, client))!;
  }

  const id = randomUUID();
  client.run(
    `
      INSERT INTO daily_records (
        id,
        profile_id,
        module,
        record_date,
        content_markdown,
        content_json,
        source_ids_json,
        source_hash,
        generator_mode,
        generated_at,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      profile.id,
      module,
      recordDate,
      built.markdown,
      toJsonString(built.content),
      toJsonString(entries.map((entry) => entry.id)),
      inputHash,
      GENERATOR_MODE.RULE,
      now,
      now,
      now,
    ],
  );

  return (await getDailyRecordByDate(recordDate, module, client))!;
}

export async function generateDailyRecordsForDate(
  recordDate: string,
  client: DatabaseClient = db,
) {
  return Promise.all([
    generateDailyRecord(recordDate, ENTRY_MODULE.LIFE, client),
    generateDailyRecord(recordDate, ENTRY_MODULE.WORK, client),
  ]);
}

export function parseWorkDailyContent(contentJson: string): WorkRecordContent {
  return parseJson<WorkRecordContent>(contentJson, {
    title: "工作日报",
    items: [],
  });
}
