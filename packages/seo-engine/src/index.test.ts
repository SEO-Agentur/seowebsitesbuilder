import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { score, PUBLISH_MIN_SCORE } from "./index";

const TEMPLATES_DIR = join(__dirname, "..", "..", "templates");

const goodPage = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>How to Pick a Domain — Seowebsitesbuilder</title>
  <meta name="description" content="A 4-minute guide on picking a memorable, ranking-friendly domain — what to favor, what to avoid, and how brand and keyword fit together.">
  <link rel="canonical" href="https://seowebsitesbuilder.com/blog/pick-domain">
  <meta property="og:title" content="How to Pick a Domain">
  <meta property="og:description" content="A 4-minute guide to picking a memorable, ranking-friendly domain.">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://seowebsitesbuilder.com/blog/pick-domain">
  <meta property="og:image" content="https://seowebsitesbuilder.com/og/pick-domain.png">
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"Article","headline":"How to Pick a Domain"}
  </script>
</head>
<body>
  <h1>How to Pick a Domain</h1>
  <p>Picking a domain is half the battle.</p>
  <img src="/img/domain.png" alt="A hand pointing at a domain name">
  <h2>What to favor</h2>
  <p>Short, brandable, .com when possible.</p>
</body>
</html>`;

const brokenPage = `<!doctype html>
<html>
<head>
</head>
<body>
  <p>Not much here.</p>
  <img src="/foo.png">
  <img src="/bar.png">
</body>
</html>`;

describe("score()", () => {
  it("returns 100 for the html starter template", () => {
    const html = readFileSync(join(TEMPLATES_DIR, "html", "index.html"), "utf8");
    const report = score(html);
    expect(report.score, JSON.stringify(report.failed, null, 2)).toBe(100);
  });

  it("scores a well-formed article ≥ 95", () => {
    const report = score(goodPage);
    expect(report.score).toBeGreaterThanOrEqual(95);
  });

  it("scores a missing-everything page ≤ 30", () => {
    const report = score(brokenPage);
    expect(report.score).toBeLessThanOrEqual(30);
    expect(report.failed.map((c) => c.id)).toEqual(
      expect.arrayContaining(["title-length", "meta-description", "single-h1", "img-alts"]),
    );
  });

  it("publish gate is 90", () => {
    expect(PUBLISH_MIN_SCORE).toBe(90);
  });
});
