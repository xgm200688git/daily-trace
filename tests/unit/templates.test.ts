import { describe, expect, it } from "vitest";

import {
  parseTemplateDefinition,
  validateTemplateDefinition,
} from "@/features/templates/service";

describe("template validation", () => {
  it("accepts a valid weekly template definition", () => {
    const definition = validateTemplateDefinition({
      version: 1,
      name: "周报模板",
      sections: [
        { key: "completedWork", title: "已完成工作", type: "bullet" },
        { key: "summary", title: "总结", type: "paragraph" },
      ],
    });

    expect(definition.sections).toHaveLength(2);
  });

  it("falls back to default template when json is broken", () => {
    const definition = parseTemplateDefinition("{");

    expect(definition.name).toBeTruthy();
    expect(definition.sections.length).toBeGreaterThan(0);
  });
});
