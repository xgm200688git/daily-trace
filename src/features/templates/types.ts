export type TemplateSectionType = "bullet" | "paragraph";

export interface TemplateSection {
  key: string;
  title: string;
  type: TemplateSectionType;
  prompt?: string;
}

export interface TemplateDefinition {
  version: number;
  name: string;
  sections: TemplateSection[];
}
