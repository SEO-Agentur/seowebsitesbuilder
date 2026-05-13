import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-black/5 bg-white sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-semibold tracking-tight text-lg">
          Seowebsitesbuilder
        </Link>
        <nav aria-label="Primary" className="flex items-center gap-6 text-sm">
          <Link href="/#features" className="text-muted hover:text-ink">Features</Link>
          <Link href="/#pricing" className="text-muted hover:text-ink">Pricing</Link>
          <Link href="/audit" className="text-muted hover:text-ink">Free audit</Link>
          <Link href="/docs" className="text-muted hover:text-ink">Docs</Link>
          <Link href="/faq" className="text-muted hover:text-ink">FAQ</Link>
          <Link href="/login" className="text-muted hover:text-ink">Log in</Link>
          <Link href="/signup" className="bg-ink text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-black">
            Sign up
          </Link>
        </nav>
      </div>
    </header>
  );
}
