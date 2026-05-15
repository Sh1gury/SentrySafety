import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { SanitizeConfig, PiiEntity } from "@/types/scan";

type ConfigErrorCode = "invalid_payload" | "unauthorized" | "engine_error";
interface ConfigError {
  status: "error";
  error: ConfigErrorCode;
  message: string;
}

interface ConfigSuccess {
  config: SanitizeConfig;
  displayName: string | null;
}

const DEFAULT_CONFIG: SanitizeConfig = {
  privacy: {
    mask_pii: true,
    entities_to_mask: ["PERSON", "CREDIT_CARD", "PHONE", "EMAIL", "IBAN", "IP"],
  },
  security: {
    block_injections: true,
    max_decompression_ratio: 100,
    strip_macros: true,
  },
  integrity: {
    check_autophagy: false,
  },
};

const PII_ENTITIES: ReadonlySet<PiiEntity> = new Set<PiiEntity>([
  "PERSON",
  "ORGANIZATION",
  "LOCATION",
  "EMAIL",
  "PHONE",
  "CREDIT_CARD",
  "IBAN",
  "IP",
]);

function fail(
  status: number,
  error: ConfigErrorCode,
  message: string,
): NextResponse<ConfigError> {
  return NextResponse.json(
    { status: "error", error, message } satisfies ConfigError,
    { status },
  );
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validatePartialConfig(
  raw: unknown,
): { ok: true; value: Partial<SanitizeConfig> } | { ok: false; message: string } {
  if (raw === undefined) return { ok: true, value: {} };
  if (!isObject(raw)) return { ok: false, message: "'config' must be an object." };

  const out: Partial<SanitizeConfig> = {};

  if ("privacy" in raw) {
    const p = raw.privacy;
    if (!isObject(p)) return { ok: false, message: "'config.privacy' must be an object." };
    const privacy: Partial<SanitizeConfig["privacy"]> = {};
    if ("mask_pii" in p) {
      if (typeof p.mask_pii !== "boolean") {
        return { ok: false, message: "'config.privacy.mask_pii' must be boolean." };
      }
      privacy.mask_pii = p.mask_pii;
    }
    if ("entities_to_mask" in p) {
      if (!Array.isArray(p.entities_to_mask)) {
        return { ok: false, message: "'config.privacy.entities_to_mask' must be an array." };
      }
      for (const e of p.entities_to_mask) {
        if (typeof e !== "string" || !PII_ENTITIES.has(e as PiiEntity)) {
          return { ok: false, message: `'config.privacy.entities_to_mask' contains invalid entity: ${String(e)}.` };
        }
      }
      privacy.entities_to_mask = p.entities_to_mask as PiiEntity[];
    }
    out.privacy = privacy as SanitizeConfig["privacy"];
  }

  if ("security" in raw) {
    const s = raw.security;
    if (!isObject(s)) return { ok: false, message: "'config.security' must be an object." };
    const security: Partial<SanitizeConfig["security"]> = {};
    if ("block_injections" in s) {
      if (typeof s.block_injections !== "boolean") {
        return { ok: false, message: "'config.security.block_injections' must be boolean." };
      }
      security.block_injections = s.block_injections;
    }
    if ("max_decompression_ratio" in s) {
      if (typeof s.max_decompression_ratio !== "number" || !Number.isFinite(s.max_decompression_ratio) || s.max_decompression_ratio <= 0) {
        return { ok: false, message: "'config.security.max_decompression_ratio' must be a positive number." };
      }
      security.max_decompression_ratio = s.max_decompression_ratio;
    }
    if ("strip_macros" in s) {
      if (typeof s.strip_macros !== "boolean") {
        return { ok: false, message: "'config.security.strip_macros' must be boolean." };
      }
      security.strip_macros = s.strip_macros;
    }
    out.security = security as SanitizeConfig["security"];
  }

  if ("integrity" in raw) {
    const i = raw.integrity;
    if (!isObject(i)) return { ok: false, message: "'config.integrity' must be an object." };
    const integrity: Partial<SanitizeConfig["integrity"]> = {};
    if ("check_autophagy" in i) {
      if (typeof i.check_autophagy !== "boolean") {
        return { ok: false, message: "'config.integrity.check_autophagy' must be boolean." };
      }
      integrity.check_autophagy = i.check_autophagy;
    }
    out.integrity = integrity as SanitizeConfig["integrity"];
  }

  return { ok: true, value: out };
}

function mergeConfig(partial: Partial<SanitizeConfig>): SanitizeConfig {
  return {
    privacy: { ...DEFAULT_CONFIG.privacy, ...partial.privacy },
    security: { ...DEFAULT_CONFIG.security, ...partial.security },
    integrity: { ...DEFAULT_CONFIG.integrity, ...partial.integrity },
  };
}

export async function GET(_req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return fail(401, "unauthorized", "unauthorized");
    }

    const { data, error } = await supabase
      .from("user_settings")
      .select("config, display_name")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (error) {
      return fail(500, "engine_error", "Failed to load settings.");
    }

    if (!data) {
      const body: ConfigSuccess = { config: DEFAULT_CONFIG, displayName: null };
      return NextResponse.json(body);
    }

    const stored = (data.config ?? {}) as Partial<SanitizeConfig>;
    const body: ConfigSuccess = {
      config: mergeConfig(stored),
      displayName: data.display_name ?? null,
    };
    return NextResponse.json(body);
  } catch {
    return fail(500, "engine_error", "Internal engine error.");
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient();
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return fail(401, "unauthorized", "unauthorized");
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return fail(400, "invalid_payload", "Request body must be valid JSON.");
    }

    if (!isObject(raw)) {
      return fail(400, "invalid_payload", "Request body must be a JSON object.");
    }

    const configResult = validatePartialConfig(raw.config);
    if (!configResult.ok) {
      return fail(400, "invalid_payload", configResult.message);
    }

    let displayName: string | null | undefined;
    if ("displayName" in raw) {
      const d = raw.displayName;
      if (d === null) {
        displayName = null;
      } else if (typeof d === "string") {
        const trimmed = d.trim();
        if (trimmed.length > 120) {
          return fail(400, "invalid_payload", "'displayName' must be 120 characters or fewer.");
        }
        displayName = trimmed.length === 0 ? null : trimmed;
      } else {
        return fail(400, "invalid_payload", "'displayName' must be string or null.");
      }
    }

    const userId = userData.user.id;

    const { data: existing, error: readErr } = await supabase
      .from("user_settings")
      .select("config, display_name")
      .eq("user_id", userId)
      .maybeSingle();

    if (readErr) {
      return fail(500, "engine_error", "Failed to load settings.");
    }

    const baseStored = (existing?.config ?? {}) as Partial<SanitizeConfig>;
    const mergedConfig = mergeConfig({
      privacy: { ...baseStored.privacy, ...configResult.value.privacy } as SanitizeConfig["privacy"],
      security: { ...baseStored.security, ...configResult.value.security } as SanitizeConfig["security"],
      integrity: { ...baseStored.integrity, ...configResult.value.integrity } as SanitizeConfig["integrity"],
    });

    const nextDisplayName =
      displayName === undefined ? (existing?.display_name ?? null) : displayName;

    const { data: upserted, error: upsertErr } = await supabase
      .from("user_settings")
      .upsert(
        {
          user_id: userId,
          config: mergedConfig,
          display_name: nextDisplayName,
        },
        { onConflict: "user_id" },
      )
      .select("config, display_name")
      .single();

    if (upsertErr || !upserted) {
      return fail(500, "engine_error", "Failed to save settings.");
    }

    const body: ConfigSuccess = {
      config: mergeConfig((upserted.config ?? {}) as Partial<SanitizeConfig>),
      displayName: upserted.display_name ?? null,
    };
    return NextResponse.json(body);
  } catch {
    return fail(500, "engine_error", "Internal engine error.");
  }
}
