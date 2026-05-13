<?php
$title = "Your New SEO-Optimized Website Built In Minutes";
$description = "A clean, fast PHP starter ready to rank. Server-rendered HTML, semantic structure, schema.org markup, and zero JavaScript by default.";
$canonical = "https://example.com/";
$ld = [
  "@context" => "https://schema.org",
  "@type" => "WebSite",
  "name" => "Your New Site",
  "url" => $canonical,
];
?><!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?= htmlspecialchars($title) ?></title>
<meta name="description" content="<?= htmlspecialchars($description) ?>">
<link rel="canonical" href="<?= htmlspecialchars($canonical) ?>">
<meta property="og:title" content="<?= htmlspecialchars($title) ?>">
<meta property="og:description" content="<?= htmlspecialchars($description) ?>">
<meta property="og:image" content="https://example.com/og.png">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<style>
  :root { --fg:#0a0a0a; --bg:#fafafa; --accent:#2563eb; --muted:#6b7280; }
  *, *::before, *::after { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: system-ui, -apple-system, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
  main { max-width: 720px; margin: 0 auto; padding: 4rem 1.5rem; }
  h1 { font-size: 2.5rem; margin: 0 0 1rem; letter-spacing: -0.02em; line-height: 1.1; }
  h2 { font-size: 1.5rem; margin: 3rem 0 1rem; }
  .lead { font-size: 1.2rem; color: var(--muted); }
  .cta { display: inline-block; background: var(--accent); color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; margin-top: 1rem; }
  footer { text-align: center; color: var(--muted); padding: 2rem; font-size: 0.875rem; }
</style>
<script type="application/ld+json"><?= json_encode($ld, JSON_UNESCAPED_SLASHES) ?></script>
</head>
<body>
<main>
  <h1>Build a website that actually ranks</h1>
  <p class="lead">This PHP starter scores 100 on Lighthouse out of the box. Server-rendered, deployable to any cPanel host or Docker target.</p>
  <a href="#start" class="cta">Get started</a>

  <h2>Why PHP</h2>
  <p>PHP runs everywhere — every shared host on the planet supports it, and modern PHP 8.3 is genuinely fast. No Node toolchain. No build step.</p>

  <h2>Your turn</h2>
  <p>Replace this copy with your own. The SEO panel scores your page in real time as you edit.</p>
</main>
<footer><p>Built with Seowebsitesbuilder</p></footer>
</body>
</html>
