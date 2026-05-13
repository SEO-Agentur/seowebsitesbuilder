/**
 * Pure-TS SEO scoring engine.
 *
 * Designed to run in two contexts:
 *   1. Browser — passed `document.documentElement.outerHTML` from the preview iframe.
 *   2. Node — passed the rendered HTML string at export time (fail the export if score < 90).
 *
 * Zero dependencies. Uses a small DOMParser shim in Node (lazy-loaded).
 */

export interface SeoCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  detail?: string;
}

export interface SeoReport {
  score: number;          // 0..100
  checks: SeoCheck[];
  passed: SeoCheck[];
  failed: SeoCheck[];
}

interface ParsedDoc {
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h2Count: number;
  imgs: { src: string; alt: string | null }[];
  htmlLang: string | null;
  hasCanonical: boolean;
  ogTags: number;
  twitterTags: number;
  hasViewport: boolean;
  hasJsonLd: boolean;
  scriptCount: number;
  externalScriptCount: number;
  rawByteLength: number;
}

function parse(html: string): ParsedDoc {
  // Use a tolerant parser. We use very light regex when DOMParser isn't trustworthy
  // for raw HTML in Node, but for browser usage DOMParser is fine.
  const isBrowser = typeof window !== "undefined";
  let title: string | null = null;
  let metaDescription: string | null = null;
  let h1Count = 0;
  let h2Count = 0;
  const imgs: { src: string; alt: string | null }[] = [];
  let htmlLang: string | null = null;
  let hasCanonical = false;
  let ogTags = 0;
  let twitterTags = 0;
  let hasViewport = false;
  let hasJsonLd = false;
  let scriptCount = 0;
  let externalScriptCount = 0;

  if (isBrowser) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    title = doc.querySelector("title")?.textContent?.trim() || null;
    metaDescription = doc.querySelector('meta[name="description"]')?.getAttribute("content")?.trim() || null;
    h1Count = doc.querySelectorAll("h1").length;
    h2Count = doc.querySelectorAll("h2").length;
    doc.querySelectorAll("img").forEach((img) => imgs.push({
      src: img.getAttribute("src") || "",
      alt: img.getAttribute("alt"),
    }));
    htmlLang = doc.documentElement.getAttribute("lang");
    hasCanonical = !!doc.querySelector('link[rel="canonical"]');
    ogTags = doc.querySelectorAll('meta[property^="og:"]').length;
    twitterTags = doc.querySelectorAll('meta[name^="twitter:"]').length;
    hasViewport = !!doc.querySelector('meta[name="viewport"]');
    hasJsonLd = !!doc.querySelector('script[type="application/ld+json"]');
    const scripts = doc.querySelectorAll("script");
    scriptCount = scripts.length;
    scripts.forEach((s) => {
      // Only count render-BLOCKING externals — async/defer/module don't block.
      if (!s.getAttribute("src")) return;
      const isAsync = s.hasAttribute("async");
      const isDefer = s.hasAttribute("defer");
      const isModule = (s.getAttribute("type") || "").toLowerCase() === "module";
      if (!isAsync && !isDefer && !isModule) externalScriptCount++;
    });
  } else {
    // Server-side regex parsing — robust enough for our scoring purposes.
    title = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").trim() || null;
    metaDescription = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || null;
    h1Count = (html.match(/<h1[\s>]/gi) || []).length;
    h2Count = (html.match(/<h2[\s>]/gi) || []).length;
    const imgRe = /<img\s+([^>]*?)\/?>/gi;
    let m;
    while ((m = imgRe.exec(html))) {
      const tag = m[1];
      const src = tag.match(/\bsrc=["']([^"']*)["']/i)?.[1] || "";
      const altMatch = tag.match(/\balt=["']([^"']*)["']/i);
      imgs.push({ src, alt: altMatch ? altMatch[1] : null });
    }
    htmlLang = html.match(/<html[^>]*\blang=["']([^"']+)["']/i)?.[1] || null;
    hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
    ogTags = (html.match(/<meta[^>]+property=["']og:/gi) || []).length;
    twitterTags = (html.match(/<meta[^>]+name=["']twitter:/gi) || []).length;
    hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
    hasJsonLd = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
    const scripts = html.match(/<script\b/gi) || [];
    scriptCount = scripts.length;
    // Count only render-blocking external scripts (skip async, defer, type=module).
    const scriptTags = html.match(/<script[^>]+\bsrc=[^>]*>/gi) || [];
    externalScriptCount = scriptTags.filter((tag) =>
      !/\basync\b/i.test(tag)
      && !/\bdefer\b/i.test(tag)
      && !/\btype=["']module["']/i.test(tag),
    ).length;
  }

  return {
    title,
    metaDescription,
    h1Count,
    h2Count,
    imgs,
    htmlLang,
    hasCanonical,
    ogTags,
    twitterTags,
    hasViewport,
    hasJsonLd,
    scriptCount,
    externalScriptCount,
    rawByteLength: new Blob ? new Blob([html]).size : html.length,
  };
}

export function score(html: string): SeoReport {
  const d = parse(html);
  const checks: SeoCheck[] = [];

  // Title 30–60 chars
  const titleLen = d.title?.length ?? 0;
  checks.push({
    id: "title-length",
    label: "Title is 30–60 characters",
    weight: 15,
    passed: titleLen >= 30 && titleLen <= 60,
    detail: d.title ? `Current: ${titleLen} chars` : "Missing <title>",
  });

  // Meta description 120–160
  const mdLen = d.metaDescription?.length ?? 0;
  checks.push({
    id: "meta-description",
    label: "Meta description is 120–160 characters",
    weight: 15,
    passed: mdLen >= 120 && mdLen <= 160,
    detail: d.metaDescription ? `Current: ${mdLen} chars` : "Missing meta description",
  });

  // Single H1
  checks.push({
    id: "single-h1",
    label: "Page has exactly one <h1>",
    weight: 10,
    passed: d.h1Count === 1,
    detail: `Found ${d.h1Count}`,
  });

  // H2 structure (warning, not heavy weight)
  checks.push({
    id: "h2-present",
    label: "Page has supporting <h2> sections",
    weight: 5,
    passed: d.h2Count >= 1,
    detail: `Found ${d.h2Count} <h2>`,
  });

  // Image alts
  const missingAlt = d.imgs.filter((i) => i.alt === null || i.alt.trim() === "").length;
  checks.push({
    id: "img-alts",
    label: "All images have meaningful alt text",
    weight: 10,
    passed: d.imgs.length === 0 || missingAlt === 0,
    detail: d.imgs.length === 0 ? "No images" : `${missingAlt}/${d.imgs.length} missing alt`,
  });

  // html lang
  checks.push({
    id: "html-lang",
    label: "Has <html lang> attribute",
    weight: 5,
    passed: !!d.htmlLang,
    detail: d.htmlLang ? `lang="${d.htmlLang}"` : "Missing",
  });

  // Canonical
  checks.push({
    id: "canonical",
    label: "Has canonical link",
    weight: 5,
    passed: d.hasCanonical,
  });

  // Open Graph
  checks.push({
    id: "og-tags",
    label: "Has Open Graph meta (og:title, og:description, og:image)",
    weight: 5,
    passed: d.ogTags >= 3,
    detail: `Found ${d.ogTags} og: tags`,
  });

  // Schema.org JSON-LD
  checks.push({
    id: "json-ld",
    label: "Has schema.org JSON-LD",
    weight: 10,
    passed: d.hasJsonLd,
  });

  // Viewport
  checks.push({
    id: "viewport",
    label: "Has viewport meta (mobile-friendly)",
    weight: 5,
    passed: d.hasViewport,
  });

  // Script weight
  checks.push({
    id: "script-budget",
    label: "≤ 1 external render-blocking script",
    weight: 10,
    passed: d.externalScriptCount <= 1,
    detail: `${d.externalScriptCount} external scripts`,
  });

  // Page weight
  const kb = d.rawByteLength / 1024;
  checks.push({
    id: "page-weight",
    label: "Page HTML < 100 KB",
    weight: 5,
    passed: kb < 100,
    detail: `${kb.toFixed(1)} KB`,
  });

  const earned = checks.filter((c) => c.passed).reduce((s, c) => s + c.weight, 0);
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const finalScore = Math.round((earned / total) * 100);

  return {
    score: finalScore,
    checks,
    passed: checks.filter((c) => c.passed),
    failed: checks.filter((c) => !c.passed),
  };
}

export const PUBLISH_MIN_SCORE = 90;
