// Local module shim for @seo/generators so tsc can typecheck the orchestrator
// without including the workspace package's source under its rootDir. The
// runtime import resolves through pnpm's workspace symlink at dev time (tsx)
// and at production build time (after the generators package is compiled).
declare module "@seo/generators" {
  export type Backend = "none" | "supabase" | "postgres" | "go";
  export type Framework = "html" | "astro" | "nextjs" | "php";

  export interface FieldDef {
    name: string;
    type: "string" | "text" | "int" | "float" | "bool" | "timestamp" | "uuid" | "json";
    required?: boolean;
    unique?: boolean;
    default?: string;
  }
  export interface ModelDef {
    name: string;
    fields: FieldDef[];
  }
  export interface ProjectConfig {
    framework: Framework;
    backend: Backend;
    projectName: string;
    models?: ModelDef[];
  }
  export interface GeneratedFile {
    path: string;
    content: string;
  }

  export function generateBackend(cfg: ProjectConfig): GeneratedFile[];
  export function generateSupabase(cfg: ProjectConfig): GeneratedFile[];
  export function generatePostgres(cfg: ProjectConfig): GeneratedFile[];
  export function generateGo(cfg: ProjectConfig): GeneratedFile[];
}
