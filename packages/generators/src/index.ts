/**
 * Backend code generators.
 *
 * Each generator takes a project config and returns a list of files to write
 * into the project directory. The generated code is hand-crafted-quality,
 * idiomatic, and runs without any reference to our platform — that's the whole
 * "no vendor lock-in" promise.
 */

import { generateSupabase } from "./supabase";
import { generatePostgres } from "./postgres";
import { generateGo } from "./go";

export type Backend = "none" | "supabase" | "postgres" | "go";
export type Framework = "html" | "astro" | "nextjs" | "php";

export interface ProjectConfig {
  framework: Framework;
  backend: Backend;
  projectName: string;
  /** schema entities the user has defined in the editor */
  models?: ModelDef[];
}

export interface ModelDef {
  name: string;            // "Post", "Product"
  fields: FieldDef[];
}

export interface FieldDef {
  name: string;            // "title"
  type: "string" | "text" | "int" | "float" | "bool" | "timestamp" | "uuid" | "json";
  required?: boolean;
  unique?: boolean;
  default?: string;        // raw SQL default expression
}

export interface GeneratedFile {
  path: string;            // relative to project root
  content: string;
}

export function generateBackend(cfg: ProjectConfig): GeneratedFile[] {
  switch (cfg.backend) {
    case "none": return [];
    case "supabase": return generateSupabase(cfg);
    case "postgres": return generatePostgres(cfg);
    case "go": return generateGo(cfg);
  }
}

export { generateSupabase, generatePostgres, generateGo };
