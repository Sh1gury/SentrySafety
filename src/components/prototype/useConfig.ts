'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ScanConfig } from './types';
import type { SanitizeConfig, PiiEntity } from '@/types/scan';

const DEFAULT_CONFIG: ScanConfig = {
  privacy: {
    mask_pii: true,
    entities_to_mask: ['PERSON', 'EMAIL', 'PHONE', 'IBAN', 'CREDIT_CARD'],
  },
  security: {
    block_injections: true,
    max_decompression_ratio: 100,
    strip_macros: true,
  },
  integrity: {
    check_autophagy: true,
  },
};

interface ConfigResponse {
  config: SanitizeConfig;
  displayName: string | null;
}

function fromSanitize(c: SanitizeConfig): ScanConfig {
  return {
    privacy: {
      mask_pii: c.privacy.mask_pii,
      entities_to_mask: [...c.privacy.entities_to_mask],
    },
    security: {
      block_injections: c.security.block_injections,
      max_decompression_ratio: c.security.max_decompression_ratio,
      strip_macros: c.security.strip_macros,
    },
    integrity: {
      check_autophagy: c.integrity.check_autophagy,
    },
  };
}

function toSanitize(c: ScanConfig): SanitizeConfig {
  return {
    privacy: {
      mask_pii: c.privacy.mask_pii,
      entities_to_mask: c.privacy.entities_to_mask as PiiEntity[],
    },
    security: { ...c.security },
    integrity: { ...c.integrity },
  };
}

export interface UseConfigResult {
  config: ScanConfig;
  setConfig: React.Dispatch<React.SetStateAction<ScanConfig>>;
  displayName: string | null;
  setDisplayName: (name: string | null) => void;
  save: () => Promise<void>;
  saving: boolean;
  savedAt: number | null;
  error: string | null;
  loading: boolean;
}

export function useConfig(): UseConfigResult {
  const [config, setConfig] = useState<ScanConfig>(DEFAULT_CONFIG);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadDone = useRef(false);

  // Keep latest values for save() without forcing a stable callback identity.
  const latest = useRef({ config, displayName });
  useEffect(() => {
    latest.current = { config, displayName };
  }, [config, displayName]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/v1/config');
        if (cancelled) return;
        if (res.status === 401) {
          initialLoadDone.current = true;
          setLoading(false);
          return;
        }
        if (!res.ok) {
          initialLoadDone.current = true;
          setLoading(false);
          return;
        }
        const body = (await res.json()) as ConfigResponse;
        if (cancelled) return;
        setConfig(fromSanitize(body.config));
        setDisplayName(body.displayName);
      } catch {
        // network failure → keep in-memory defaults
      } finally {
        if (!cancelled) {
          initialLoadDone.current = true;
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: toSanitize(latest.current.config),
          displayName: latest.current.displayName,
        }),
      });
      if (!res.ok) {
        if (res.status !== 401) {
          setError('Failed to save settings.');
        }
        // Even on 401 we silently swallow — demo mode.
      } else {
        setSavedAt(Date.now());
        if (savedTimer.current) clearTimeout(savedTimer.current);
        savedTimer.current = setTimeout(() => setSavedAt(null), 2000);
      }
    } catch {
      setError('Network error while saving.');
    } finally {
      setSaving(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    const t = setTimeout(() => {
      save();
    }, 500);
    return () => clearTimeout(t);
  }, [config, save]);

  return { config, setConfig, displayName, setDisplayName, save, saving, savedAt, error, loading };
}
