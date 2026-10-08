export type Sample = { row: number; obs: number | null; seconds: number; start?: string; end?: string; note?: string | null; flag?: string }
export type Excluded = { row: number; raw: string; reason: string }
export type Link = { process: string; nodes: string[]; lane?: string; confidence: string; note: string | null }
export type Step = {
  id: string; label: string; phase: string; n: number; mean: number; median: number; min: number; max: number; stdev: number | null
  samples: Sample[]; excluded: Excluded[]; source: string; kind: string; link: Link
}
export type NodeInfo = { id: string; name: string; kind: string; lane: string | null; doc: string; gw: string | null; origin?: string; x: number; y: number; via: string | null; seq: number }
export type Process = {
  id: string; title: string; short: string; poolName: string; sourceFile: string; bpmn: string
  lanes: { id: string; name: string }[]; nodes: NodeInfo[]
  counts: { tasks: number; gateways: number; events: number; flows: number; lanes: number }
  totalLabel: { value: string; note: string; text: string } | null
}
export type Quality = { id: string; level: string; title: string; text: string }
export type Measurements = {
  source: string; unit: string; steps: Step[]; emptySteps: { label: string; cols: string }[]
  laneSteps: Record<string, string[]>; quality: Quality[]
  plan: Plan
}
export type Plan = {
  target: number; perVisit: number; perWeek: number; excluded: string[]; visits: number; lastDone: string; end: string; next: string; bottleneck: string[]; weekdays: number[]
  steps: { id: string; label: string; n: number; missing: number; visits: number }[]
  schedule: { n: number; date: string; closes: string[]; lowest: number }[]
}
export type Dataset = { processes: Process[]; m: Measurements }

export async function loadDataset(): Promise<Dataset> {
  const base = import.meta.env.BASE_URL
  const [p, m] = await Promise.all([
    fetch(base + 'data/processes.json').then((r) => r.json()),
    fetch(base + 'data/measurements.json').then((r) => r.json()),
  ])
  return { processes: p.processes, m }
}

/** 1 s → "42 s" · 338 s → "5 min 38 s" · 4500 s → "1 h 15 min" */
export function fmt(s: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (s == null || Number.isNaN(s)) return '—'
  const t = Math.round(s)
  if (t < 60) return `${t} s`
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), r = t % 60
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`
  if (opts.compact) return r ? `${m}:${String(r).padStart(2, '0')} min` : `${m} min`
  return r ? `${m} min ${r} s` : `${m} min`
}

export function quantile(sorted: number[], q: number) {
  if (!sorted.length) return NaN
  const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function describe(step: Step) {
  const v = step.samples.map((s) => s.seconds).sort((a, b) => a - b)
  const q1 = quantile(v, 0.25), q3 = quantile(v, 0.75)
  const fence = q3 + 1.5 * (q3 - q1)
  return { q1, q3, fence, outliers: step.samples.filter((s) => s.seconds > fence) }
}

export const JOURNEY = (steps: Step[]) => steps.filter((s) => s.id !== 'pos-consulta-ociosidade')

export const WD = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
export const planDate = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
export const weekday = (iso: string) => WD[(new Date(iso + 'T12:00').getDay() + 6) % 7]
