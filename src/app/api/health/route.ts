export async function GET() {
  return Response.json({
    ok: true,
    demoMode: process.env.DEMO_MODE === "true",
    version: "1.0.0",
  });
}
