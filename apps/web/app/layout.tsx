import type { Metadata, Viewport } from "next";
import "./globals.css";

const SITE = "https://seowebsitesbuilder.com";
const TITLE = "Seowebsitesbuilder — SEO-Perfect Sites in Minutes";
const DESCRIPTION =
  "No-code platform for SEO-perfect websites. Real-time scoring, multi-framework export (Next.js, Astro, PHP, HTML). From $19/mo with your own LLM key.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: TITLE, template: "%s · Seowebsitesbuilder" },
  description: DESCRIPTION,
  alternates: { canonical: SITE + "/" },
  keywords: [
    "no-code website builder",
    "SEO website builder",
    "Next.js builder",
    "Astro builder",
    "PHP website builder",
    "Lighthouse 100",
    "BYOK",
    "December alternative",
  ],
  authors: [{ name: "Seowebsitesbuilder" }],
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE + "/",
    siteName: "Seowebsitesbuilder",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Seowebsitesbuilder — SEO-perfect websites in minutes" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/og.png"],
  },
  robots: { index: true, follow: true },
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#ffffff",
};

const ORG_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Seowebsitesbuilder",
  url: SITE,
  logo: SITE + "/favicon.svg",
  description: DESCRIPTION,
  sameAs: ["https://github.com/seowebsitesbuilder"],
};

const SOFTWARE_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Seowebsitesbuilder",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "19", priceCurrency: "USD" },
  description: DESCRIPTION,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify([ORG_LD, SOFTWARE_LD]) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
