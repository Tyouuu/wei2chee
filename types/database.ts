export interface Industry {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  has_verified_discovery: boolean;
  labels: { customer: string; order: string; staff: string };
  default_workflow: string[];
  suggested_modules: string[];
  style_recommendation: string | null;
}

export interface ReferenceCase {
  id: string;
  industry_id: string;
  is_verified: boolean;
  anonymous_name_zh: string;
  anonymous_name_en: string;
  pain_points: string[];
  modules: string[];
  workflow: string[];
  highlights_zh: string[];
  highlights_en: string[];
  source: "internal" | "inferred";
}

export interface Lead {
  id: string;
  created_at: string;
  industry_id: string | null;
  language: "zh" | "en";
  answers: Record<string, string | string[]>;
  style_selected: string | null;
}

export interface AnalysisResult {
  id: string;
  lead_id: string;
  bottlenecks: { icon: string; title: string; description: string }[];
  before_workflow: string[];
  after_workflow: string[];
  summary: string;
  generated_at: string;
}
