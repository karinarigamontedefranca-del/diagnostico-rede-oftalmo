import type { NodeInfo, Process } from './data'

/** Uma saída possível a partir de um nó: para onde vai, com que rótulo (Sim/Não…) e por quais fluxos passa. */
export type Option = { to: string; label: string | null; flowIds: string[] }

export type Graph = {
  p: Process
  node: (id: string) => NodeInfo
  out: (id: string) => Option[]
  isDecision: (id: string) => boolean
  isEnd: (id: string) => boolean
  startId: string
  /** primeiro nó depois do início: se um laço volta para ele, o ciclo recomeça */
  firstId: string
}

const tidy = (s: string | null | undefined) => {
  const t = (s || '').trim()
  return t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : null
}

export function makeGraph(p: Process): Graph {
  const byId = new Map(p.nodes.map((n) => [n.id, n]))
  const outs = new Map<string, typeof p.flows>()
  p.flows.forEach((f) => { if (!outs.has(f.src)) outs.set(f.src, []); outs.get(f.src)!.push(f) })
  const isMerge = (n: NodeInfo) => n.kind === 'exclusiveGateway' && !n.name && (outs.get(n.id)?.length ?? 0) === 1
  const node = (id: string) => byId.get(id)!
  /** segue o fluxo atravessando desvios sem pergunta (junções) */
  const resolve = (f: (typeof p.flows)[number]): Option => {
    const ids = [f.id]; let dst = f.dst, guard = 0
    while (isMerge(node(dst)) && guard++ < 10) { const nf = outs.get(dst)![0]; ids.push(nf.id); dst = nf.dst }
    return { to: dst, label: tidy(f.name), flowIds: ids }
  }
  const startId = p.nodes.find((n) => n.kind === 'startEvent')!.id
  return {
    p, node,
    out: (id) => (outs.get(id) || []).map(resolve),
    isDecision: (id) => node(id).kind === 'exclusiveGateway' && (outs.get(id)?.length ?? 0) > 1,
    isEnd: (id) => node(id).kind === 'endEvent',
    startId,
    firstId: resolve(outs.get(startId)![0]).to,
  }
}

/** próximo passo sem escolha: devolve o destino ou null se for decisão/fim/laço de recomeço */
export function autoNext(g: Graph, id: string): Option | null {
  if (g.isDecision(id)) return null
  const o = g.out(id)
  return o.length === 1 ? o[0] : null
}

/** a saída leva de volta ao começo do fluxo (novo ciclo)? */
export const restarts = (g: Graph, o: Option, from: string) => o.to === g.firstId && from !== g.startId
