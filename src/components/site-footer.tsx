import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="lp-border-light border-t mt-16">
      <div className="max-w-6xl mx-auto px-6 pt-12 pb-8">
        <div className="flex flex-col sm:flex-row justify-between gap-10">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="lp-text-1 font-semibold text-sm tracking-tight" style={{ textDecoration: "none" }}>
              Sentry Safety
            </Link>
            <p className="lp-text-2 text-xs leading-relaxed mt-3">
              Pre-RAG firewall for enterprise AI pipelines. Scans, sanitises,
              and anonymises documents before they reach your vector store.
            </p>
          </div>

          {/* Columns */}
          <div className="flex gap-12 sm:gap-16 text-xs">
            <div>
              <p className="lp-text-3 font-semibold uppercase tracking-widest mb-4">Product</p>
              <ul className="flex flex-col gap-3">
                <li><Link href="/docs" className="lp-footer-link">Documentation</Link></li>
                <li><Link href="/dashboard" className="lp-footer-link">Dashboard</Link></li>
                <li><a href="#" className="lp-footer-link">Changelog</a></li>
              </ul>
            </div>
            <div>
              <p className="lp-text-3 font-semibold uppercase tracking-widest mb-4">Company</p>
              <ul className="flex flex-col gap-3">
                <li><a href="#" className="lp-footer-link">About</a></li>
                <li><a href="#" className="lp-footer-link">Contact</a></li>
              </ul>
            </div>
            <div>
              <p className="lp-text-3 font-semibold uppercase tracking-widest mb-4">Legal</p>
              <ul className="flex flex-col gap-3">
                <li><a href="#" className="lp-footer-link">Privacy</a></li>
                <li><a href="#" className="lp-footer-link">Terms</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="lp-border-light border-t mt-10 pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <p className="lp-text-3 text-xs">&copy; 2026 Sentry Safety</p>
          <p className="lp-text-3 text-xs">Infomatrix Global Final &mdash; Bucharest, Romania</p>
        </div>
      </div>
    </footer>
  );
}
