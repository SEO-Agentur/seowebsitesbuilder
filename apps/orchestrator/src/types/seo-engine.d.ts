// Module shim so tsc can typecheck the orchestrator without pulling the
// @seo/seo-engine TS source under its rootDir. tsx + pnpm symlink handles
// runtime resolution.
declare module "@seo/seo-engine" {
  export interface SeoCheck {
    id: string;
    label: string;
    weight: number;
    passed: boolean;
    detail?: string;
  }
  export interface SeoReport {
    score: number;
    checks: SeoCheck[];
    passed: SeoCheck[];
    failed: SeoCheck[];
  }
  export function score(html: string): SeoReport;
  export const PUBLISH_MIN_SCORE: number;
}
