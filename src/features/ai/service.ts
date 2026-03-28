import OpenAI from "openai";

import { DEFAULT_OPENAI_MODEL } from "@/lib/constants";
import type { TemplateDefinition } from "@/features/templates/types";

interface WeeklyAiInput {
  template: TemplateDefinition;
  context: string;
}

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function maybeGenerateLifeSummary(
  enabled: boolean,
  content: string,
): Promise<string | null> {
  const client = enabled ? getOpenAIClient() : null;

  if (!client) {
    return null;
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "你是中文日记助手。请基于当天生活记录生成 1 段不超过 90 字的自然总结，不要虚构没有出现的事实。",
        },
        {
          role: "user",
          content,
        },
      ],
    });

    return response.output_text.trim() || null;
  } catch {
    return null;
  }
}

export async function maybeGenerateWeeklySections(
  enabled: boolean,
  input: WeeklyAiInput,
): Promise<Record<string, string[] | string> | null> {
  const client = enabled ? getOpenAIClient() : null;

  if (!client) {
    return null;
  }

  try {
    const response = await client.responses.create({
      model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
      input: [
        {
          role: "system",
          content:
            "你是中文周报助手。严格输出 JSON 对象，键名必须与模板 sections 的 key 一致。bullet 类型输出字符串数组，paragraph 类型输出字符串。不要编造事实。",
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              template: input.template,
              context: input.context,
            },
            null,
            2,
          ),
        },
      ],
    });

    const raw = response.output_text.trim();
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as Record<string, string[] | string>;
  } catch {
    return null;
  }
}
