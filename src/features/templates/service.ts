import { randomUUID } from "node:crypto";

import { z } from "zod";

import {
  DEFAULT_PROFILE_ID,
  DEFAULT_TEMPLATE_DEFINITION,
} from "@/lib/constants";
import {
  db,
  fromDbBoolean,
  nowIso,
  type DatabaseClient,
} from "@/lib/db";
import { parseJson, toJsonString } from "@/lib/json";
import type { TemplateDefinition } from "@/features/templates/types";

export interface TemplateRecord {
  id: string;
  profileId: number;
  name: string;
  version: number;
  isDefault: boolean;
  definitionJson: string;
  createdAt: string;
  updatedAt: string;
}

const templateSectionSchema = z.object({
  key: z.string().trim().min(1),
  title: z.string().trim().min(1),
  type: z.enum(["bullet", "paragraph"]).default("bullet"),
  prompt: z.string().trim().optional(),
});

const templateDefinitionSchema = z.object({
  version: z.number().int().min(1),
  name: z.string().trim().min(1),
  sections: z.array(templateSectionSchema).min(1),
});

function mapTemplate(row: {
  id: string;
  profile_id: number;
  name: string;
  version: number;
  is_default: number;
  definition_json: string;
  created_at: string;
  updated_at: string;
}): TemplateRecord {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    version: row.version,
    isDefault: fromDbBoolean(row.is_default),
    definitionJson: row.definition_json,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function validateTemplateDefinition(input: unknown): TemplateDefinition {
  return templateDefinitionSchema.parse(input);
}

export function parseTemplateDefinition(definitionJson: string): TemplateDefinition {
  return validateTemplateDefinition(
    parseJson(definitionJson, DEFAULT_TEMPLATE_DEFINITION),
  );
}

export function serializeTemplateDefinition(
  definition: TemplateDefinition,
): string {
  return toJsonString(validateTemplateDefinition(definition));
}

export async function listTemplates(
  client: DatabaseClient = db,
): Promise<TemplateRecord[]> {
  const rows = client.all<{
    id: string;
    profile_id: number;
    name: string;
    version: number;
    is_default: number;
    definition_json: string;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM templates
      WHERE profile_id = ?
      ORDER BY is_default DESC, updated_at DESC
    `,
    [DEFAULT_PROFILE_ID],
  );

  return rows.map(mapTemplate);
}

export async function ensureDefaultTemplate(
  client: DatabaseClient = db,
): Promise<TemplateRecord> {
  const existing = client.get<{
    id: string;
    profile_id: number;
    name: string;
    version: number;
    is_default: number;
    definition_json: string;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM templates
      WHERE profile_id = ? AND is_default = 1
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID],
  );

  if (existing) {
    return mapTemplate(existing);
  }

  const fallback = client.get<{
    id: string;
    profile_id: number;
    name: string;
    version: number;
    is_default: number;
    definition_json: string;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM templates
      WHERE profile_id = ?
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID],
  );

  const now = nowIso();

  if (fallback) {
    client.run(
      `
        UPDATE templates
        SET is_default = 1, updated_at = ?
        WHERE id = ?
      `,
      [now, fallback.id],
    );

    return mapTemplate({
      ...fallback,
      is_default: 1,
      updated_at: now,
    });
  }

  const id = randomUUID();
  client.run(
    `
      INSERT INTO templates (
        id,
        profile_id,
        name,
        version,
        is_default,
        definition_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      DEFAULT_PROFILE_ID,
      DEFAULT_TEMPLATE_DEFINITION.name,
      DEFAULT_TEMPLATE_DEFINITION.version,
      1,
      serializeTemplateDefinition(DEFAULT_TEMPLATE_DEFINITION),
      now,
      now,
    ],
  );

  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    name: DEFAULT_TEMPLATE_DEFINITION.name,
    version: DEFAULT_TEMPLATE_DEFINITION.version,
    isDefault: true,
    definitionJson: serializeTemplateDefinition(DEFAULT_TEMPLATE_DEFINITION),
    createdAt: now,
    updatedAt: now,
  };
}

export async function getTemplateById(
  templateId: string,
  client: DatabaseClient = db,
): Promise<TemplateRecord | null> {
  const row = client.get<{
    id: string;
    profile_id: number;
    name: string;
    version: number;
    is_default: number;
    definition_json: string;
    created_at: string;
    updated_at: string;
  }>(
    `
      SELECT *
      FROM templates
      WHERE profile_id = ? AND id = ?
      LIMIT 1
    `,
    [DEFAULT_PROFILE_ID, templateId],
  );

  return row ? mapTemplate(row) : null;
}

export async function getDefaultTemplate(
  client: DatabaseClient = db,
): Promise<TemplateRecord> {
  return ensureDefaultTemplate(client);
}

export async function saveTemplateFromRawJson(
  rawJson: string,
  nameOverride: string | undefined,
  existingId?: string,
  client: DatabaseClient = db,
): Promise<TemplateRecord> {
  const parsed = validateTemplateDefinition(JSON.parse(rawJson));
  const name = nameOverride?.trim() || parsed.name;
  const now = nowIso();

  if (existingId) {
    client.run(
      `
        UPDATE templates
        SET name = ?, version = ?, definition_json = ?, updated_at = ?
        WHERE id = ?
      `,
      [
        name,
        parsed.version,
        serializeTemplateDefinition({ ...parsed, name }),
        now,
        existingId,
      ],
    );

    return (await getTemplateById(existingId, client))!;
  }

  const id = randomUUID();
  const definitionJson = serializeTemplateDefinition({ ...parsed, name });

  client.run(
    `
      INSERT INTO templates (
        id,
        profile_id,
        name,
        version,
        is_default,
        definition_json,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [id, DEFAULT_PROFILE_ID, name, parsed.version, 0, definitionJson, now, now],
  );

  return {
    id,
    profileId: DEFAULT_PROFILE_ID,
    name,
    version: parsed.version,
    isDefault: false,
    definitionJson,
    createdAt: now,
    updatedAt: now,
  };
}

export async function setDefaultTemplate(
  templateId: string,
  client: DatabaseClient = db,
): Promise<void> {
  const now = nowIso();

  client.transaction(() => {
    client.run(
      `
        UPDATE templates
        SET is_default = 0, updated_at = ?
        WHERE profile_id = ?
      `,
      [now, DEFAULT_PROFILE_ID],
    );
    client.run(
      `
        UPDATE templates
        SET is_default = 1, updated_at = ?
        WHERE id = ?
      `,
      [now, templateId],
    );
    client.run(
      `
        UPDATE profile_settings
        SET default_template_id = ?, updated_at = ?
        WHERE id = ?
      `,
      [templateId, now, DEFAULT_PROFILE_ID],
    );
  });
}
