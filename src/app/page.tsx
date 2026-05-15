import Link from "next/link";

const INSTALL_SNIPPET = `npm install @sentry-safety/sdk`;

const USAGE_SNIPPET = `import { SentrySafety } from "@sentry-safety/sdk";

const shield = new SentrySafety({ apiKey: process.env.SENTRY_SAFETY_KEY! });

const { clean_text, verdict } = await shield.sanitize(file, {
  privacy:   { mask_pii: true, entities_to_mask: ["PERSON", "IBAN"] },
  security:  { block_injections: true, strip_macros: true, max_decompression_ratio: 100 },
  integrity: { check_autophagy: false },
});

if (verdict !== "allow") throw new Error("blocked");
// clean_text is safe to embed into your RAG pipeline`;

const layers = [
  {
    number: "01",
    label: "Deterministic",
    description:
      "Runs locally — no LLM, no outbound calls. Regex PII masking (IBAN, cards, phones, emails), NER via wink-nlp, MIME magic-byte validation, zip-bomb guard, DOCX macro stripping, and a prompt-injection signature list.",
    tag: "Always on",
    tagStyle: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  {
    number: "02",
    label: "Semantic",
    description:
      "llama-3.3-70b-versatile on Groq via sandwich prompting. Two parallel agents: semantic (subtle jailbreaks, role-escalation) and logic (data poisoning). Groq only ever sees text already PII-masked by Layer 1.",
    tag: "LLM ensemble",
    tagStyle: "bg-sky-50 text-sky-700 border border-sky-200",
  },
  {
    number: "03",
    label: "Integrity",
    description:
      "Detects AI-generated slop to prevent vector-store autophagy. Off by default; enabled per request via config.integrity.check_autophagy. Drops synthetic paragraphs before they reach your embedding pipeline.",
    tag: "Opt-in",
    tagStyle: "bg-violet-50 text-violet-700 border border-violet-200",
  },
];

const features = [
  {
    title: "PII never reaches the LLM",
    body: "Layer 1 tokenises names, IBANs, cards, and phones before the document leaves your infrastructure. Groq sees [PERSON_1], not Bogdana.",
  },
  {
    title: "Prompt injection blocked pre-embedding",
    body: "Adversarial instructions hidden in vendor PDFs or resumes are stripped at ingest — before they poison your vector store.",
  },
  {
    title: "One HTTP call",
    body: "POST /api/v1/sanitize returns clean_text, a verdict, and a full audit trail in a single round-trip. Drop it in front of any RAG pipeline.",
  },
  {
    title: "DEMO_MODE for offline runs",
    body: "Layer 1 always runs. Layer 2 falls back to a deterministic shim when DEMO_MODE=true. Venue Wi-Fi failure is not a demo failure.",
  },
];

export default function Home() {
  return (
    <div className="light-page min-h-screen bg-white text-zinc-900 font-sans antialiased">
      {/* Nav */}
      <header className="border-b border-zinc-100 sticky top-0 bg-white/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight">
            Sentry Safety
          </span>
          <nav className="flex items-center gap-6 text-sm text-zinc-500">
            <Link
              href="/docs"
              className="hover:text-zinc-900 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/docs#api"
              className="hover:text-zinc-900 transition-colors"
            >
              API
            </Link>
            <Link
              href="/dashboard"
              className="ml-2 rounded-md bg-zinc-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Dashboard
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20">
        <div className="max-w-2xl">
          <span className="inline-block mb-5 rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 tracking-wide uppercase">
            Pre-RAG Firewall
          </span>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight text-zinc-900 mb-6">
            PII never reaches
            <br />
            the LLM.
          </h1>
          <p className="text-lg text-zinc-500 leading-relaxed mb-8 max-w-xl">
            Sentry Safety is a B2B middleware that scans, sanitises, and
            anonymises documents{" "}
            <span className="text-zinc-900 font-medium">
              before they touch your vector store
            </span>
            . Three layers, one HTTP call.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/docs#quickstart"
              className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Quickstart
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Install strip */}
      <section className="border-y border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-widest shrink-0">
            Install
          </span>
          <code className="font-mono text-sm text-zinc-800 bg-white border border-zinc-200 rounded-md px-4 py-2 select-all">
            {INSTALL_SNIPPET}
          </code>
        </div>
      </section>

      {/* Three layers */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
            Three layers of protection
          </h2>
          <p className="text-zinc-500 text-base max-w-lg">
            Each layer adds what the previous one cannot. Together they cover
            the full attack surface of a document ingestion pipeline.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {layers.map((layer) => (
            <div
              key={layer.number}
              className="border border-zinc-200 rounded-xl p-6 bg-white hover:border-zinc-300 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl font-bold text-zinc-100 select-none">
                  {layer.number}
                </span>
                <span
                  className={`text-xs font-medium rounded-full px-2.5 py-0.5 ${layer.tagStyle}`}
                >
                  {layer.tag}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-900 mb-2">
                {layer.label}
              </h3>
              <p className="text-sm text-zinc-500 leading-relaxed">
                {layer.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Code sample */}
      <section className="border-y border-zinc-100 bg-zinc-950">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="max-w-3xl mx-auto">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-4">
              SDK
            </p>
            <pre className="overflow-x-auto rounded-xl bg-zinc-900 border border-zinc-700 p-6 text-sm leading-relaxed">
              <code className="text-zinc-200 font-mono">{USAGE_SNIPPET}</code>
            </pre>
            <p className="mt-4 text-sm text-zinc-400">
              Full SDK reference →{" "}
              <Link
                href="/docs#sdk"
                className="text-zinc-200 underline underline-offset-2 hover:text-white transition-colors"
              >
                /docs#sdk
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* Feature grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-12">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 mb-2">
            Built for production RAG
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {features.map((f) => (
            <div key={f.title}>
              <h3 className="font-semibold text-zinc-900 mb-1.5">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-100 bg-zinc-50">
        <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <h2 className="text-xl font-semibold text-zinc-900 mb-1">
              Ready to protect your pipeline?
            </h2>
            <p className="text-zinc-500 text-sm">
              Open the dashboard to run a live scan, or read the docs to
              integrate in minutes.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Link
              href="/dashboard"
              className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 transition-colors"
            >
              Open dashboard
            </Link>
            <Link
              href="/docs"
              className="rounded-md border border-zinc-200 px-5 py-2.5 text-sm font-medium text-zinc-700 bg-white hover:bg-zinc-50 transition-colors"
            >
              Read the docs
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-400">
          <span>Sentry Safety — Infomatrix 2026</span>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-zinc-600 transition-colors">
              Docs
            </Link>
            <Link href="/docs#api" className="hover:text-zinc-600 transition-colors">
              API
            </Link>
            <Link href="/docs#sdk" className="hover:text-zinc-600 transition-colors">
              SDK
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
