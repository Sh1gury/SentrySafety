import { renderPrometheus } from "@/lib/metrics";

export async function GET() {
  return new Response(renderPrometheus(), {
    headers: { "Content-Type": "text/plain; version=0.0.4" },
  });
}
