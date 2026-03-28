import { describe, expect, it } from "vitest";

import { buildRuleWeeklySections, renderWeeklyMarkdown } from "@/features/reports/service";
import type { TemplateDefinition } from "@/features/templates/types";

const template: TemplateDefinition = {
  version: 1,
  name: "默认模板",
  sections: [
    { key: "completedWork", title: "已完成工作", type: "bullet" },
    { key: "issues", title: "问题阻塞", type: "bullet" },
  ],
};

describe("weekly report builders", () => {
  it("builds sections from work daily records", () => {
    const sections = buildRuleWeeklySections(template, [
      {
        id: "record-1",
        profileId: 1,
        module: "work",
        recordDate: "2026-03-24",
        contentMarkdown: "# 工作日报",
        contentJson: JSON.stringify({
          title: "工作日报",
          items: [
            {
              id: "task-1",
              time: "10:00",
              title: "完成日报页",
              description: "解决模板切换问题",
            },
            {
              id: "task-2",
              time: "15:00",
              title: "排查接口",
              description: "发现阻塞：接口超时",
            },
          ],
        }),
        sourceIdsJson: "[]",
        sourceHash: "hash-1",
        generatorMode: "rule",
        generatedAt: "2026-03-24T10:00:00.000Z",
        updatedAt: "2026-03-24T10:00:00.000Z",
      },
    ]);

    expect(sections.completedWork).toEqual([
      "完成日报页：解决模板切换问题",
      "排查接口：发现阻塞：接口超时",
    ]);
    expect(sections.issues).toEqual(["排查接口：发现阻塞：接口超时"]);
  });

  it("renders markdown with section headings", () => {
    const markdown = renderWeeklyMarkdown(
      template,
      {
        completedWork: ["完成日报页"],
        issues: ["接口超时"],
      },
      "2026-03-23",
      "2026-03-29",
    );

    expect(markdown).toContain("## 已完成工作");
    expect(markdown).toContain("完成日报页");
    expect(markdown).toContain("## 问题阻塞");
  });
});
