import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your New SEO-Optimized Website Built In Minutes",
  description:
    "A clean, fast Next.js starter ready to rank. Static export, semantic HTML, schema.org, Open Graph — all pre-wired.",
  alternates: { canonical: "https://example.com/" },
  openGraph: {
    title: "Your New SEO-Optimized Website Built In Minutes",
    description: "A clean, fast Next.js starter ready to rank.",
    url: "https://example.com/",
    type: "website",
    images: [{ url: "https://example.com/og.png" }],
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const ldJson = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Your New Site",
    url: "https://example.com/",
  };
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ldJson) }}
        />
        <style>{`
          :root { --fg:#0a0a0a; --bg:#fafafa; --accent:#2563eb; --muted:#6b7280; }
          *, *::before, *::after { box-sizing: border-box; }
          html, body { margin: 0; padding: 0; font-family: system-ui, -apple-system, sans-serif; color: var(--fg); background: var(--bg); line-height: 1.6; }
          main { max-width: 720px; margin: 0 auto; padding: 4rem 1.5rem; }
          h1 { font-size: 2.5rem; margin: 0 0 1rem; letter-spacing: -0.02em; line-height: 1.1; }
          h2 { font-size: 1.5rem; margin: 3rem 0 1rem; }
          .lead { font-size: 1.2rem; color: var(--muted); }
          .cta { display: inline-block; background: var(--accent); color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 600; margin-top: 1rem; }
          footer { text-align: center; color: var(--muted); padding: 2rem; font-size: 0.875rem; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
