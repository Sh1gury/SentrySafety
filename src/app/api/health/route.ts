import { cacheSize } from "@/lib/cache";
import { auditCount } from "@/lib/auditLog";
import { circuitState } from "@/lib/circuitBreaker";

export async function GET() {
  return Response.json({
    ok: true,
    demoMode: process.env.DEMO_MODE === "true",
    version: "1.0.0",
    cacheSize: cacheSize(),
    auditCount: auditCount(),
    circuit: {
      layer2: circuitState("layer2"),
    },
  });
}
