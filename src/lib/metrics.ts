/**
 * Sentry Safety — Prometheus-style in-memory metrics.
 *
 * No external dependencies. Supports counters via `inc(name, labels)` and
 * histograms via `observe(name, value, labels)`. Output is the standard
 * Prometheus text exposition format.
 */

type LabelSet = Record<string, string>;

interface CounterSeries {
  labels: LabelSet;
  value: number;
}

interface HistogramSeries {
  labels: LabelSet;
  buckets: number[]; // cumulative counts aligned with HISTOGRAM_BUCKETS
  sum: number;
  count: number;
}

const HISTOGRAM_BUCKETS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const counters = new Map<string, CounterSeries[]>();
const histograms = new Map<string, HistogramSeries[]>();

function labelsKey(labels: LabelSet): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(",");
}

function findOrCreate<T extends { labels: LabelSet }>(
  store: Map<string, T[]>,
  name: string,
  labels: LabelSet,
  factory: () => T,
): T {
  let arr = store.get(name);
  if (!arr) {
    arr = [];
    store.set(name, arr);
  }
  const key = labelsKey(labels);
  for (const s of arr) {
    if (labelsKey(s.labels) === key) return s;
  }
  const fresh = factory();
  arr.push(fresh);
  return fresh;
}

export function inc(name: string, labels: LabelSet = {}): void {
  const series = findOrCreate(counters, name, labels, () => ({
    labels: { ...labels },
    value: 0,
  }));
  series.value += 1;
}

export function observe(name: string, value: number, labels: LabelSet = {}): void {
  const series = findOrCreate(histograms, name, labels, () => ({
    labels: { ...labels },
    buckets: HISTOGRAM_BUCKETS.map(() => 0),
    sum: 0,
    count: 0,
  }));

  for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
    if (value <= HISTOGRAM_BUCKETS[i]) {
      series.buckets[i] += 1;
    }
  }
  series.sum += value;
  series.count += 1;
}

function formatLabels(labels: LabelSet, extra?: LabelSet): string {
  const merged: LabelSet = { ...labels, ...(extra ?? {}) };
  const keys = Object.keys(merged);
  if (keys.length === 0) return "";
  const parts = keys.map((k) => `${k}="${escapeLabelValue(merged[k])}"`);
  return `{${parts.join(",")}}`;
}

function escapeLabelValue(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

export function renderPrometheus(): string {
  const lines: string[] = [];

  for (const [name, seriesList] of counters) {
    lines.push(`# HELP ${name} Counter.`);
    lines.push(`# TYPE ${name} counter`);
    for (const s of seriesList) {
      lines.push(`${name}${formatLabels(s.labels)} ${s.value}`);
    }
  }

  for (const [name, seriesList] of histograms) {
    lines.push(`# HELP ${name} Histogram.`);
    lines.push(`# TYPE ${name} histogram`);
    for (const s of seriesList) {
      for (let i = 0; i < HISTOGRAM_BUCKETS.length; i++) {
        lines.push(
          `${name}_bucket${formatLabels(s.labels, { le: String(HISTOGRAM_BUCKETS[i]) })} ${s.buckets[i]}`,
        );
      }
      lines.push(
        `${name}_bucket${formatLabels(s.labels, { le: "+Inf" })} ${s.count}`,
      );
      lines.push(`${name}_sum${formatLabels(s.labels)} ${s.sum}`);
      lines.push(`${name}_count${formatLabels(s.labels)} ${s.count}`);
    }
  }

  return lines.join("\n") + (lines.length > 0 ? "\n" : "");
}
