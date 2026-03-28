import {
  DEFAULT_PROFILE_ID,
  DEFAULT_TIMEZONE,
  DEFAULT_WEEK_STARTS_ON,
} from "@/lib/constants";
import {
  db,
  fromDbBoolean,
  nowIso,
  toDbBoolean,
  type DatabaseClient,
} from "@/lib/db";
import { ensureDefaultTemplate } from "@/features/templates/service";

export interface ProfileSettingsRecord {
  id: number;
  timezone: string;
  weekStartsOn: number;
  aiEnabled: boolean;
  defaultTemplateId: string | null;
  createdAt: string;
  updatedAt: string;
}

function mapProfile(row: {
  id: number;
  timezone: string;
  week_starts_on: number;
  ai_enabled: number;
  default_template_id: string | null;
  created_at: string;
  updated_at: string;
}): ProfileSettingsRecord {
  return {
    id: row.id,
    timezone: row.timezone,
    weekStartsOn: row.week_starts_on,
    aiEnabled: fromDbBoolean(row.ai_enabled),
    defaultTemplateId: row.default_template_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureProfileSettings(
  client: DatabaseClient = db,
): Promise<ProfileSettingsRecord> {
  const existing = client.get<{
    id: number;
    timezone: string;
    week_starts_on: number;
    ai_enabled: number;
    default_template_id: string | null;
    created_at: string;
    updated_at: string;
  }>("SELECT * FROM profile_settings WHERE id = ?", [DEFAULT_PROFILE_ID]);

  if (!existing) {
    const now = nowIso();
    client.run(
      `
        INSERT INTO profile_settings (
          id,
          timezone,
          week_starts_on,
          ai_enabled,
          default_template_id,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        DEFAULT_PROFILE_ID,
        DEFAULT_TIMEZONE,
        DEFAULT_WEEK_STARTS_ON,
        0,
        null,
        now,
        now,
      ],
    );
  }

  const template = await ensureDefaultTemplate(client);
  const profile =
    client.get<{
      id: number;
      timezone: string;
      week_starts_on: number;
      ai_enabled: number;
      default_template_id: string | null;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM profile_settings WHERE id = ?", [DEFAULT_PROFILE_ID])!;

  if (profile.default_template_id !== template.id) {
    const now = nowIso();
    client.run(
      `
        UPDATE profile_settings
        SET default_template_id = ?, updated_at = ?
        WHERE id = ?
      `,
      [template.id, now, DEFAULT_PROFILE_ID],
    );
  }

  const refreshed =
    client.get<{
      id: number;
      timezone: string;
      week_starts_on: number;
      ai_enabled: number;
      default_template_id: string | null;
      created_at: string;
      updated_at: string;
    }>("SELECT * FROM profile_settings WHERE id = ?", [DEFAULT_PROFILE_ID])!;

  return mapProfile(refreshed);
}

export async function setAiEnabled(
  enabled: boolean,
  client: DatabaseClient = db,
): Promise<void> {
  await ensureProfileSettings(client);
  client.run(
    `
      UPDATE profile_settings
      SET ai_enabled = ?, updated_at = ?
      WHERE id = ?
    `,
    [toDbBoolean(enabled), nowIso(), DEFAULT_PROFILE_ID],
  );
}
