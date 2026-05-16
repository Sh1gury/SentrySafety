'use client';

import React from 'react';

// ---------- Character maps ----------

// Zero-width / invisible formatting characters
const ZERO_WIDTH: Record<string, string> = {
  '​': 'ZWSP',   // Zero-Width Space
  '‌': 'ZWNJ',   // Zero-Width Non-Joiner
  '‍': 'ZWJ',    // Zero-Width Joiner
  '⁠': 'WJ',     // Word Joiner
  '᠎': 'MVS',    // Mongolian Vowel Separator
  '﻿': 'BOM',    // Zero-Width No-Break Space / BOM
};

// Bidi-override / directional formatting
const BIDI: Record<string, string> = {
  '‪': 'LRE',    // Left-to-Right Embedding
  '‫': 'RLE',    // Right-to-Left Embedding
  '‬': 'PDF',    // Pop Directional Formatting
  '‭': 'LRO',    // Left-to-Right Override
  '‮': 'RLO',    // Right-to-Left Override
  '⁦': 'LRI',    // Left-to-Right Isolate
  '⁧': 'RLI',    // Right-to-Left Isolate
  '⁨': 'FSI',    // First Strong Isolate
  '⁩': 'PDI',    // Pop Directional Isolate
};

// Cyrillic homoglyphs of Latin letters
const CYRILLIC_HOMOGLYPHS: Record<string, string> = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'х': 'x',
  'А': 'A', 'В': 'B', 'Е': 'E', 'Н': 'H', 'К': 'K', 'М': 'M',
  'О': 'O', 'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X',
};

const SYSTEM_PROMPT_PATTERNS = [
  /^<\|system\|>/i,
  /^<\|im_start\|>system/i,
  /^\[INST\]/i,
  /^###\s*system/i,
  /^system\s*:/i,
  /^<system>/i,
];

// ---------- Detection ----------

export function hasSuspiciousChars(text: string): boolean {
  if (!text) return false;
  for (const ch of text) {
    if (ZERO_WIDTH[ch]) return true;
    if (BIDI[ch]) return true;
    if (CYRILLIC_HOMOGLYPHS[ch]) return true;
  }
  // trailing whitespace > 3
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/[ \t]+$/);
    if (m && m[0].length > 3) return true;
    for (const pat of SYSTEM_PROMPT_PATTERNS) {
      if (pat.test(line.trim())) return true;
    }
  }
  return false;
}

// ---------- Token model ----------

type Token =
  | { kind: 'text'; value: string }
  | { kind: 'zw'; label: string }
  | { kind: 'bidi'; label: string }
  | { kind: 'homoglyph'; ch: string; latin: string }
  | { kind: 'trailing-ws'; count: number }
  | { kind: 'system-line'; value: string }
  | { kind: 'newline' };

function isLatinLetter(ch: string | undefined): boolean {
  if (!ch) return false;
  return /[A-Za-z]/.test(ch);
}

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];

  // Detect system-prompt-style line
  for (const pat of SYSTEM_PROMPT_PATTERNS) {
    if (pat.test(line.trim())) {
      tokens.push({ kind: 'system-line', value: line });
      return tokens;
    }
  }

  // Detect trailing whitespace run > 3
  const trailMatch = line.match(/^(.*?)([ \t]{4,})$/);
  let body = line;
  let trailing: number | null = null;
  if (trailMatch) {
    body = trailMatch[1];
    trailing = trailMatch[2].length;
  }

  let buf = '';
  const flush = () => {
    if (buf) { tokens.push({ kind: 'text', value: buf }); buf = ''; }
  };

  const chars = Array.from(body);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];

    if (ZERO_WIDTH[ch]) {
      flush();
      tokens.push({ kind: 'zw', label: ZERO_WIDTH[ch] });
      continue;
    }
    if (BIDI[ch]) {
      flush();
      tokens.push({ kind: 'bidi', label: BIDI[ch] });
      continue;
    }
    if (CYRILLIC_HOMOGLYPHS[ch]) {
      // Only flag if surrounded by (or adjacent to) Latin letters
      const prev = chars[i - 1];
      const next = chars[i + 1];
      if (isLatinLetter(prev) || isLatinLetter(next)) {
        flush();
        tokens.push({ kind: 'homoglyph', ch, latin: CYRILLIC_HOMOGLYPHS[ch] });
        continue;
      }
    }
    buf += ch;
  }
  flush();

  if (trailing !== null) {
    tokens.push({ kind: 'trailing-ws', count: trailing });
  }

  return tokens;
}

function tokenize(text: string): Token[] {
  const lines = text.split('\n');
  const out: Token[] = [];
  lines.forEach((line, idx) => {
    out.push(...tokenizeLine(line));
    if (idx < lines.length - 1) out.push({ kind: 'newline' });
  });
  return out;
}

// ---------- Rendering ----------

const STYLES = {
  pre: {
    fontFamily: 'var(--mono)',
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-word' as const,
    margin: 0,
    padding: '12px 14px',
    background: 'var(--surface2)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    color: 'var(--text)',
    minHeight: 168,
    maxHeight: 320,
    overflowY: 'auto' as const,
  },
  zwBadge: {
    display: 'inline-block',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    padding: '0 5px',
    margin: '0 2px',
    borderRadius: 3,
    background: 'rgba(239,68,68,0.18)',
    color: '#ef4444',
    border: '1px solid rgba(239,68,68,0.35)',
    verticalAlign: 'middle' as const,
    letterSpacing: '0.04em',
  },
  bidiBadge: {
    display: 'inline-block',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    padding: '0 5px',
    margin: '0 2px',
    borderRadius: 3,
    background: 'rgba(249,115,22,0.18)',
    color: '#f97316',
    border: '1px solid rgba(249,115,22,0.35)',
    verticalAlign: 'middle' as const,
    letterSpacing: '0.04em',
  },
  homoglyph: {
    background: 'rgba(234,179,8,0.16)',
    color: '#eab308',
    borderBottom: '2px solid #eab308',
    padding: '0 1px',
    borderRadius: 2,
    cursor: 'help' as const,
  },
  trailingWs: {
    display: 'inline-block',
    fontFamily: 'var(--mono)',
    fontSize: 10,
    padding: '0 5px',
    margin: '0 2px',
    borderRadius: 3,
    background: 'rgba(239,68,68,0.12)',
    color: '#ef4444',
    border: '1px dashed rgba(239,68,68,0.35)',
    verticalAlign: 'middle' as const,
  },
  systemLine: {
    display: 'inline-block',
    background: 'rgba(239,68,68,0.10)',
    borderLeft: '3px solid #ef4444',
    padding: '2px 8px',
    color: '#fca5a5',
    width: '100%',
    boxSizing: 'border-box' as const,
  },
  emptyNote: {
    display: 'inline-block',
    marginTop: 8,
    padding: '6px 10px',
    fontFamily: 'var(--mono)',
    fontSize: 11,
    color: 'var(--accent, #22c55e)',
    background: 'rgba(34,197,94,0.10)',
    border: '1px solid rgba(34,197,94,0.30)',
    borderRadius: 4,
    letterSpacing: '0.04em',
  },
};

export function XRayView({ text }: { text: string }) {
  const tokens = tokenize(text);
  const suspicious = hasSuspiciousChars(text);

  return (
    <div>
      <pre style={STYLES.pre}>
        {tokens.map((tok, i) => {
          switch (tok.kind) {
            case 'text':
              return <span key={i}>{tok.value}</span>;
            case 'newline':
              return <br key={i} />;
            case 'zw':
              return (
                <span key={i} style={STYLES.zwBadge} title={`Zero-width character: ${tok.label}`}>
                  [{tok.label}]
                </span>
              );
            case 'bidi':
              return (
                <span key={i} style={STYLES.bidiBadge} title={`Bidi-override: ${tok.label}`}>
                  [{tok.label}]
                </span>
              );
            case 'homoglyph':
              return (
                <span
                  key={i}
                  style={STYLES.homoglyph}
                  title={`Cyrillic ${tok.ch} (looks like Latin ${tok.latin})`}
                >
                  {tok.ch}
                </span>
              );
            case 'trailing-ws':
              return (
                <span key={i} style={STYLES.trailingWs} title={`${tok.count} trailing whitespace chars`}>
                  [WS×{tok.count}]
                </span>
              );
            case 'system-line':
              return (
                <span key={i} style={STYLES.systemLine} title="Looks like a system-prompt directive">
                  {tok.value}
                </span>
              );
          }
        })}
      </pre>
      {!suspicious && text.length > 0 && (
        <div style={STYLES.emptyNote}>
          ✓ No hidden characters detected in input.
        </div>
      )}
      {text.length === 0 && (
        <div style={{ ...STYLES.emptyNote, color: 'var(--text3)', background: 'transparent', border: '1px dashed var(--border)' }}>
          (empty input — paste text or load a sample to inspect)
        </div>
      )}
    </div>
  );
}
