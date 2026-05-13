import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-black/5 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-10 text-sm text-muted">
        <div className="grid md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="font-semibold text-ink mb-3">Seowebsitesbuilder</div>
            <p className="leading-relaxed">
              The no-code platform for SEO-perfect websites. Real-time scoring, multi-framework export, BYOK.
            </p>
          </div>
          <div>
            <div className="font-semibold text-ink mb-3">Product</div>
            <ul className="space-y-2">
              <li><Link href="/#features" className="hover:text-ink">Features</Link></li>
              <li><Link href="/#pricing" className="hover:text-ink">Pricing</Link></li>
              <li><Link href="/signup" className="hover:text-ink">Sign up</Link></li>
              <li><Link href="/login" className="hover:text-ink">Log in</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink mb-3">Resources</div>
            <ul className="space-y-2">
              <li><Link href="/docs" className="hover:text-ink">Documentation</Link></li>
              <li><Link href="/faq" className="hover:text-ink">FAQ</Link></li>
            </ul>
          </div>
          <div>
            <div className="font-semibold text-ink mb-3">Legal</div>
            <ul className="space-y-2">
              <li><Link href="/privacy" className="hover:text-ink">Privacy policy</Link></li>
              <li><Link href="/terms" className="hover:text-ink">Terms of service</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-black/5 pt-6 flex flex-wrap gap-6 justify-between">
          <div>© 2026 Seowebsitesbuilder. All rights reserved.</div>
          <div>Made for SEO operators who care about real rankings.</div>
        </div>
      </div>
    </footer>
  );
}
