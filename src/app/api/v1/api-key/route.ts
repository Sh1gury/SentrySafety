import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHmac } from "crypto";

function deriveApiKey(userId: string): string {
  const secret = process.env.API_KEY_SECRET ?? "dev-secret-change-in-production";
  const hash = createHmac("sha256", secret).update(userId).digest("hex");
  return `ss_live_${hash.slice(0, 32)}`;
}

export async function GET(): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ apiKey: deriveApiKey(user.id) });
  } catch {
    return NextResponse.json({ error: "engine_error" }, { status: 500 });
  }
}
