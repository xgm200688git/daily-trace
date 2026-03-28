import { randomUUID } from "node:crypto";

import { maybeGenerateWeeklySections } from "@/features/ai/service";
import { ensureProfileSettings } from "@/features/settings/service";
import { type TemplateRecord, getDefaultTemplate, getTemplateById, parseTemplateDefinition } from "@/features/templates/service";
import type { TemplateDefinition } from "@/features/templates/types";
import {
  DEFAULT_PROFILE_ID,
  GENERATOR_MODE,
} from "@/lib/constants";
import { db, fromDbBoolean, nowIso, toDbBoolean, type DatabaseClient } from "@/lib/db";
import { hashValue } from "@/lib/hash";
import { parseJson, toJsonString } from "@/lib/json";
import {
  chineseDateLabel,
  listDateKeysInRange,
  weekEndFromStartKey,
} from "@/lib/time";

export interface DailyRecordRow {
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

export interface WeeklyReportRecord {
  id: string;
  profileId: number;
  templateId: string | null;
  weekStart: string;
  weekEnd: string;
  revision: number;
  isCurrent: boolean;
  contentMarkdown: string;
  sectionsJson: string;
  sourceRecordIdsJson: string;
  sourceHash: string;
  generatorMode: "rule" | "ai";
  generatedAt: string;
  createdAt: string;
  template: TemplateRecord | null;
}

type WeeklySectionMap = Record<string, string[] | string>;

interface WorkRecordContent {
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
}): DailyRecordRow {
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

function compactLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean);
}

function parseWorkDailyContent(contentJson: string): WorkRecordContent {
  return parseJson<WorkRecordContent>(contentJson, {
    title: "工作日报",
    items: [],
  });
}

function buildUnknownSection(
  title: string,
  records: DailyRecordRow[],
  type: "bullet" | "paragraph",
) {
  const message = `本周共记录 ${records.length} 天工作日报，可继续围绕“${title}”补充总结。`;
  return type === "paragraph" ? message : [message];
}

export function buildRuleWeeklySections(
  template: TemplateDefinition,
  dailyRecords: DailyRecordRow[],
): WeeklySectionMap {
  const allItems = dailyRecords.flatMap((record) =>
    parseWorkDailyContent(record.contentJson).items,
  );

  const completedWork = allItems.map(
    (item) => `${item.title}${item.description ? `：${item.description}` : ""}`,
  );
  const achievements = compactLines(
    allItems.slice(0, 5).map((item) => `推进 ${item.title}`),
  );
  const issueCandidates = allItems
    .filter((item) => {
      if (/(阻塞|风险|卡住|延期|超时|异常)/.test(item.description)) {
        return true;
      }

      return /问题/.test(item.description) && !/(解决|修复)/.test(item.description);
    })
    .map(
      (item) =>
        `${item.title}${item.description ? `：${item.description}` : ""}`,
    );
  const nextPlan = compactLines(
    allItems.slice(-3).map((item) => `继续跟进 ${item.title}`),
  );

  return Object.fromEntries(
    template.sections.map((section) => {
      switch (section.key) {
        case "completedWork":
          return [section.key, completedWork.length ? completedWork : ["本周暂无完成项。"]];
        case "achievements":
          return [section.key, achievements.length ? achievements : ["本周成果以稳定推进为主。"]];
        case "issues":
          return [section.key, issueCandidates.length ? issueCandidates : ["本周未记录明确阻塞。"]];
        case "nextPlan":
          return [section.key, nextPlan.length ? nextPlan : ["下周继续推进当前重点任务。"]];
        default:
          return [
            section.key,
            buildUnknownSection(section.title, dailyRecords, section.type),
          ];
      }
    }),
  );
}

export function renderWeeklyMarkdown(
  template: TemplateDefinition,
  sections: WeeklySectionMap,
  weekStart: string,
  weekEnd: string,
): string {
  const lines = [
    `# 周报 · ${chineseDateLabel(weekStart)} - ${chineseDateLabel(weekEnd)}`,
    "",
  ];

  for (const section of template.sections) {
    lines.push(`## ${section.title}`);
    const value = sections[section.key];

    if (Array.isArray(value)) {
      lines.push(...value.map((item) => `- ${item}`));
    } else if (typeof value === "string") {
      lines.push(value);
    } else {
      lines.push("- 暂无内容");
    }

    lines.push("");
  }

  return lines.join("\n").trim();
}

function normalizeAiSections(
  template: TemplateDefinition,
  aiOutput: Record<string, string[] | string> | null,
): WeeklySectionMap | null {
  if (!aiOutput) {
    return null;
  }

  const normalized: WeeklySectionMap = {};

  for (const section of template.sections) {
    const value = aiOutput[section.key];
    if (section.type === "paragraph") {
      normalized[section.key] =
        typeof value === "string" ? value.trim() : "";
      continue;
    }

    normalized[section.key] = Array.isArray(value)
      ? value.map((item) => item.trim()).filter(Boolean)
      : [];
  }

  return normalized;
}

async function listWorkDailyRecordsForWeek(
  weekStart: string,
  client: DatabaseClient,
) {
  const weekEnd = weekEndFromStartKey(weekStart);
  const dates = listDateKeysInRange(weekStart, weekEnd);
  const rows = client.all<{
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
      WHERE profile_id = ?
        AND module = 'work'
        AND record_date IN (${dates.map(() => "?").join(",")})
      ORDER BY record_date ASC
    `,
    [DEFAULT_PROFILE_ID, ...dates],
  );

  return rows
    .map(mapDailyRecord)
    .filter((record) => parseWorkDailyContent(record.contentJson).items.length > 0);
}

function mapWeeklyReport(
  row: {
    id: string;
    profile_id: number;
    template_id: string | null;
    week_start: string;
    week_end: string;
    revision: number;
    is_current: number;
    content_markdown: string;
    sections_json: string;
    source_record_ids_json: string;
    source_hash: string;
    generator_mode: "rule" | "ai";
    generated_at: string;
    created_at: string;
  },
  template: TemplateRecord | null,
): WeeklyReportRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    templateId: row.template_id,
    weekStart: row.week_start,
    weekEnd: row.week_end,
    revision: row.revision,
    isCurrent: fromDbBoolean(row.is_current),
    contentMarkdown: row.content_markdown,
    sectionsJson: row.sections_json,
    sourceRecordIdsJson: row.source_record_ids_json,
    sourceHash: row.source_hash,
    generatorMode: row.generator_mode,
    generatedAt: row.generated_at,
    createdAt: row.created_at,
    template,
  };
}

async function getTemplateMap(client: DatabaseClient) {
  const templates = await client.all<{
    id: string;
    profile_id: number;
    name: string;
    version: number;
    is_default: number;
    definition_json: string;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM templates WHERE profile_id = ?", [DEFAULT_PROFILE_ID]);

  return new Map(
    templates.map((row) => [
      row.id,
      {
        id: row.id,
        profileId: row.profile_id,
        name: row.name,
        version: row.version,
        isDefault: fromDbBoolean(row.is_default),
        definitionJson: row.definition_json,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      } satisfies TemplateRecord,
    ]),
  );
}

export async function generateWeeklyReportForWeek(
  weekStart: string,
  options?: {
    templateId?: string;
  },
  client: DatabaseClient = db,
) {
  const profile = await ensureProfileSettings(client);
  const weekEnd = weekEndFromStartKey(weekStart);
  const candidateTemplate = options?.templateId
    ? await getTemplateById(options.templateId, client)
    : null;
  const template = candidateTemplate ?? (await getDefaultTemplate(client));
  const templateDefinition = parseTemplateDefinition(template.definitionJson);
  const dailyRecords = await listWorkDailyRecordsForWeek(weekStart, client);
  const inputHash = hashValue({
    weekStart,
    templateId: template.id,
    templateDefinition: template.definitionJson,
    aiEnabled: profile.aiEnabled,
    sources: dailyRecords.map((record) => [record.id, record.sourceHash]),
  });
  const existingCurrent = client.get<{
    id: string;
    profile_id: number;
    template_id: string | null;
    week_start: string;
    week_end: string;
    revision: number;
    is_current: number;
    content_markdown: string;
    sections_json: string;
    source_record_ids_json: string;
    source_hash: string;
    generator_mode: "rule" | "ai";
    generated_at: string;
    created_at: string;
  }>(
    `
      SELECT *
      FROM weekly_reports
      WHERE profile_id = ? AND week_start = ? AND is_current = 1
      ORDER BY revision DESC
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID, weekStart],
  );

  if (!dailyRecords.length) {
    if (existingCurrent) {
      client.run(
        `
          UPDATE weekly_reports
          SET is_current = 0
          WHERE id = ?
        `,
        [existingCurrent.id],
      );
    }
    return null;
  }

  if (existingCurrent?.source_hash === inputHash) {
    return mapWeeklyReport(existingCurrent, template);
  }

  const ruleSections = buildRuleWeeklySections(templateDefinition, dailyRecords);
  const aiContext = dailyRecords
    .map((record) => `${record.recordDate}\n${record.contentMarkdown}`)
    .join("\n\n");
  const aiSections = normalizeAiSections(
    templateDefinition,
    await maybeGenerateWeeklySections(profile.aiEnabled, {
      template: templateDefinition,
      context: aiContext,
    }),
  );
  const sections = aiSections ?? ruleSections;
  const generatorMode = aiSections ? GENERATOR_MODE.AI : GENERATOR_MODE.RULE;

  const latest = client.get<{ revision: number }>(
    `
      SELECT revision
      FROM weekly_reports
      WHERE profile_id = ? AND week_start = ?
      ORDER BY revision DESC
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID, weekStart],
  );

  const revision = (latest?.revision ?? 0) + 1;
  const contentMarkdown = renderWeeklyMarkdown(
    templateDefinition,
    sections,
    weekStart,
    weekEnd,
  );
  const id = randomUUID();
  const now = nowIso();

  client.transaction(() => {
    client.run(
      `
        UPDATE weekly_reports
        SET is_current = 0
        WHERE profile_id = ? AND week_start = ? AND is_current = 1
      `,
      [DEFAULT_PROFILE_ID, weekStart],
    );

    client.run(
      `
        INSERT INTO weekly_reports (
          id,
          profile_id,
          template_id,
          week_start,
          week_end,
          revision,
          is_current,
          content_markdown,
          sections_json,
          source_record_ids_json,
          source_hash,
          generator_mode,
          generated_at,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        profile.id,
        template.id,
        weekStart,
        weekEnd,
        revision,
        toDbBoolean(true),
        contentMarkdown,
        toJsonString(sections),
        toJsonString(dailyRecords.map((record) => record.id)),
        inputHash,
        generatorMode,
        now,
        now,
      ],
    );
  });

  return (await getCurrentWeeklyReport(weekStart, client))!;
}

export async function getCurrentWeeklyReport(
  weekStart: string,
  client: DatabaseClient = db,
): Promise<WeeklyReportRecord | null> {
  const templateMap = await getTemplateMap(client);
  const row = client.get<{
    id: string;
    profile_id: number;
    template_id: string | null;
    week_start: string;
    week_end: string;
    revision: number;
    is_current: number;
    content_markdown: string;
    sections_json: string;
    source_record_ids_json: string;
    source_hash: string;
    generator_mode: "rule" | "ai";
    generated_at: string;
    created_at: string;
  }>(
    `
      SELECT *
      FROM weekly_reports
      WHERE profile_id = ? AND week_start = ? AND is_current = 1
      ORDER BY revision DESC
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID, weekStart],
  );

  return row
    ? mapWeeklyReport(row, row.template_id ? templateMap.get(row.template_id) ?? null : null)
    : null;
}

export async function listWeeklyReportHistory(
  client: DatabaseClient = db,
): Promise<WeeklyReportRecord[]> {
  const templateMap = await getTemplateMap(client);
  const rows = client.all<{
    id: string;
    profile_id: number;
    template_id: string | null;
    week_start: string;
    week_end: string;
    revision: number;
    is_current: number;
    content_markdown: string;
    sections_json: string;
    source_record_ids_json: string;
    source_hash: string;
    generator_mode: "rule" | "ai";
    generated_at: string;
    created_at: string;
  }>(
    `
      SELECT *
      FROM weekly_reports
      WHERE profile_id = ?
      ORDER BY week_start DESC, revision DESC
      LIMIT 6
    `,
    [DEFAULT_PROFILE_ID],
  );

  return rows.map((row) =>
    mapWeeklyReport(
      row,
      row.template_id ? templateMap.get(row.template_id) ?? null : null,
    ),
  );
}

export function parseWeeklySections(
  sectionsJson: string,
): Record<string, string[] | string> {
  return parseJson<Record<string, string[] | string>>(sectionsJson, {});
}
