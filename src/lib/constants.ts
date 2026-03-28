import type { TemplateDefinition } from "@/features/templates/types";

export const APP_NAME = "每日轨迹";
export const DEFAULT_PROFILE_ID = 1;
export const DEFAULT_TIMEZONE = "Asia/Shanghai";
export const DEFAULT_WEEK_STARTS_ON = 1;
export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
export const DEFAULT_CRON_SECRET_HEADER = "x-cron-secret";
export const ENTRY_MODULE = {
  LIFE: "life",
  WORK: "work",
} as const;
export const WORK_TASK_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
} as const;
export const GENERATOR_MODE = {
  RULE: "rule",
  AI: "ai",
} as const;
export const JOB_TYPE = {
  DAILY_MERGE: "daily_merge",
  WEEKLY_REPORT: "weekly_report",
  RECONCILE: "reconcile",
} as const;
export const JOB_STATUS = {
  RUNNING: "running",
  SUCCESS: "success",
  FAILED: "failed",
} as const;

export type EntryModule = (typeof ENTRY_MODULE)[keyof typeof ENTRY_MODULE];
export type WorkTaskStatus =
  (typeof WORK_TASK_STATUS)[keyof typeof WORK_TASK_STATUS];
export type GeneratorMode =
  (typeof GENERATOR_MODE)[keyof typeof GENERATOR_MODE];

export const DEFAULT_TEMPLATE_DEFINITION: TemplateDefinition = {
  version: 1,
  name: "默认周报模板",
  sections: [
    {
      key: "completedWork",
      title: "已完成工作",
      type: "bullet",
    },
    {
      key: "achievements",
      title: "成果亮点",
      type: "bullet",
    },
    {
      key: "issues",
      title: "问题阻塞",
      type: "bullet",
    },
    {
      key: "nextPlan",
      title: "下周计划",
      type: "bullet",
    },
  ],
};
