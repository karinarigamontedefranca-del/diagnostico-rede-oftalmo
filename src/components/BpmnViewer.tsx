import { useEffect, useMemo, useRef, useState } from 'react'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import { Process, Step, fmt } from '../lib/data'
import { makeGraph, autoNext, restarts } from '../lib/walk'

type Sel = { id: string; type: 'node' | 'lane' } | null

export default function BpmnViewer({ process, steps, focusStep }: { process: Process; steps: Step[]; focusStep?: string }) {
  const host = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const viewer = useRef<any>(null)
  const [sel, setSel] = useState<Sel>(null)
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  // percurso guiado: a pessoa decide o caminho em cada decisão
  const graph = useMemo(() => makeGraph(process), [process])
  const [walk, setWalk] = useState<{ nodes: string[]; segs: string[][] } | null>(null)
  const walkCur = walk ? walk.nodes[walk.nodes.length - 1] : null
  const walkOpts = walkCur && graph.isDecision(walkCur) ? graph.out(walkCur) : []
  const step1 = (o: ReturnType<typeof graph.out>[number] | null, from: string) => {
    if (!o || !walk || restarts(graph, o, from)) return
    setWalk({ nodes: [...walk.nodes, o.to], segs: [...walk.segs, o.flowIds] })
  }

  const laneName = (id: string | null) => process.lanes.find((l) => l.id === id)?.name
  const byNode = useMemo(() => {
    const m: Record<string, Step[]> = {}
    steps.forEach((s) => s.link.nodes.forEach((n) => (m[n] ||= []).push(s)))
    return m
  }, [steps])
  const byLane = useMemo(() => {
    const m: Record<string, Step[]> = {}
    steps.forEach((s) => s.link.lane && (m[s.link.lane] ||= []).push(s))
    return m
  }, [steps])
  const nodeInfo = (id: string) => process.nodes.find((n) => n.id === id)

  useEffect(() => {
    let dead = false
    const v = new NavigatedViewer({
      container: host.current!,
      textRenderer: { defaultStyle: { fontFamily: '"Hanken Grotesk", sans-serif', fontSize: 11, lineHeight: 1.15 }, externalStyle: { fontSize: 11, lineHeight: 1.2 } },
      zoomScroll: { enabled: false },
    })
    viewer.current = v
    fetch(import.meta.env.BASE_URL + process.bpmn)
      .then((r) => r.text())
      .then((xml) => v.importXML(xml))
      .then(() => {
        if (dead) return
        const canvas = v.get('canvas'), overlays = v.get('overlays'), registry = v.get('elementRegistry'), bus = v.get('eventBus')
        canvas.zoom('fit-viewport', 'auto')
        registry.forEach((el: any) => {
          if (el.type === 'bpmn:StartEvent') canvas.addMarker(el.id, 'node-start')
          if (el.type === 'bpmn:EndEvent') canvas.addMarker(el.id, 'node-end')
          if (el.type === 'bpmn:Task' || el.type === 'bpmn:ExclusiveGateway' || el.type === 'bpmn:StartEvent' || el.type === 'bpmn:EndEvent') canvas.addMarker(el.id, 'pickable')
          if (byNode[el.id]) {
            canvas.addMarker(el.id, 'has-data')
            const ss = byNode[el.id]
            const html = document.createElement('div'); html.className = 'badge-t'
            html.textContent = ss.length === 1 ? fmt(ss[0].mean, { compact: true }) : `${ss.length} medições`
            overlays.add(el.id, { position: { top: -24, left: 0 }, html })
          }
          const ni = process.nodes.find((x) => x.id === el.id)
          if (ni && ni.origin && ni.origin !== 'diagrama' && ni.kind !== 'textAnnotation') canvas.addMarker(el.id, 'from-interview')
          if (el.type === 'bpmn:Lane' && byLane[el.id]) canvas.addMarker(el.id, 'lane-data')
        })
        bus.on('element.click', (e: any) => {
          const el = e.element
          if (el.type === 'bpmn:Lane') setSel({ id: el.id, type: 'lane' })
          else if (el.type === 'bpmn:Participant' || el.type === 'label' || el.type === 'bpmn:TextAnnotation' || el.type === 'bpmn:Association') setSel(null)
          else setSel({ id: el.id, type: 'node' })
        })
        bus.on('canvas.click', () => setSel(null))
        bus.on('element.hover', (e: any) => {
          const id = e.element.id, ss = byNode[id]
          const info = e.element.type === 'bpmn:Lane' ? null : nodeInfo(id)
          const rect = stage.current!.getBoundingClientRect(), oe = e.originalEvent
          if (info && info.name && oe) setTip({ x: oe.clientX - rect.left, y: oe.clientY - rect.top, text: ss ? `${info.name} · média ${fmt(ss[0].mean)}` : info.name })
        })
        bus.on('element.out', () => setTip(null))
        setReady(true)
      })
      .catch((e: any) => !dead && setError(String(e?.message || e)))

    const el = host.current!
    const wheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return
      e.preventDefault()
      const c = v.get('canvas'), r = el.getBoundingClientRect()
      c.zoom(c.zoom() * (e.deltaY < 0 ? 1.12 : 1 / 1.12), { x: e.clientX - r.left, y: e.clientY - r.top })
    }
    el.addEventListener('wheel', wheel, { passive: false })
    return () => { dead = true; el.removeEventListener('wheel', wheel); v.destroy() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [process.id])

  useEffect(() => {
    const v = viewer.current
    if (!ready || !v) return
    const canvas = v.get('canvas'), registry = v.get('elementRegistry')
    registry.forEach((el: any) => canvas.removeMarker(el.id, 'picked'))
    if (sel) canvas.addMarker(sel.id, 'picked')
  }, [sel, ready])

  useEffect(() => {
    if (!ready || !focusStep) return
    const s = steps.find((x) => x.id === focusStep)
    if (s?.link.nodes[0]) setSel({ id: s.link.nodes[0], type: 'node' })
    else if (s?.link.lane) setSel({ id: s.link.lane, type: 'lane' })
  }, [ready, focusStep, steps])

  useEffect(() => {
    const v = viewer.current; if (!ready || !v) return
    const canvas = v.get('canvas'), registry = v.get('elementRegistry')
    registry.forEach((el: any) => { ['walk-done', 'walk-cur'].forEach((m) => canvas.removeMarker(el.id, m)) })
    if (!walk) return
    walk.nodes.forEach((id, i) => canvas.addMarker(id, i === walk.nodes.length - 1 ? 'walk-cur' : 'walk-done'))
    walk.segs.flat().forEach((id) => canvas.addMarker(id, 'walk-done'))
  }, [walk, ready])

  const zoom = (f: number | 'fit') => {
    const c = viewer.current?.get('canvas'); if (!c) return
    f === 'fit' ? c.zoom('fit-viewport', 'auto') : c.zoom(c.zoom() * f)
  }

  let panel: React.ReactNode = null
  if (sel) {
    const isLane = sel.type === 'lane'
    const info = isLane ? null : nodeInfo(sel.id)
    const ss = (isLane ? byLane[sel.id] : byNode[sel.id]) || []
    const title = isLane ? laneName(sel.id) : info?.name || (info?.kind === 'startEvent' ? 'Início do processo' : info?.kind === 'endEvent' ? 'Fim do processo' : 'Decisão')
    const kindLabel = isLane ? "Raia" : info?.kind === "textAnnotation" ? "Anotação" : info?.kind === 'task' ? 'Etapa' : info?.kind === 'exclusiveGateway' ? 'Decisão' : info?.kind === 'startEvent' ? 'Início' : 'Fim'
    panel = (
      <aside className="side" aria-live="polite">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
          <div>
            <span className="pill gray">{kindLabel}</span>{!isLane && info?.origin && info.origin !== 'diagrama' && <span className={`pill ${info.origin === 'a confirmar' ? 'amber' : ''}`} style={{ marginLeft: 6 }}>{info.origin === 'entrevista' ? 'acrescentada com base na entrevista' : info.origin}</span>}
            <h4 style={{ fontSize: 22, margin: '10px 0 2px' }}>{title}</h4>
            {!isLane && info?.lane && <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>Raia: {laneName(info.lane)}</div>}
          </div>
          <button aria-label="Fechar" onClick={() => setSel(null)} style={{ border: 0, background: 'none', fontSize: 22, lineHeight: 1, color: 'var(--color-muted)' }}>×</button>
        </div>
        {info?.doc && <p style={{ fontSize: 14, margin: '12px 0 0', color: 'var(--color-text)', background: 'var(--color-amber-soft)', padding: '8px 12px', borderRadius: 10 }}>{info.doc}</p>}
        {ss.map((s) => (
          <div key={s.id} style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
              <b>{s.label}</b>
              {s.link.confidence !== 'raia' && <span className="pill amber">{s.link.confidence === 'provável' ? 'associação provável' : s.link.confidence}</span>}
            </div>
            <dl className="statgrid">
              <div><dt>Tempo médio</dt><dd className="num">{fmt(s.mean)}</dd></div>
              <div><dt>Medições</dt><dd className="num">{s.n}</dd></div>
              <div><dt>Menor tempo</dt><dd className="num">{fmt(s.min)}</dd></div>
              <div><dt>Maior tempo</dt><dd className="num">{fmt(s.max)}</dd></div>
            </dl>
            {s.link.note && <p style={{ fontSize: 13, color: 'var(--color-muted)', margin: '10px 0 0' }}>{s.link.note}</p>}
            <a className="btn" style={{ marginTop: 12 }} href={`#/processo/${process.id}?etapa=${s.id}`} onClick={() => setTimeout(() => document.getElementById('medicoes')?.scrollIntoView({ behavior: 'smooth' }), 50)}>Ver medições</a>
          </div>
        ))}
        {!ss.length && <p style={{ fontSize: 14, color: 'var(--color-muted)', margin: '14px 0 0' }}>{process.id === 'glaucoma' ? 'Sem medição associada a esta etapa na planilha.' : 'Este processo não tem medições na planilha recebida.'}</p>}
      </aside>
    )
  }

  return (
    <div className="flow" ref={stage}>
      <div className="stage" ref={host} role="img" aria-label={`Fluxograma BPMN: ${process.poolName}`} />
      {error && <p style={{ padding: 24, color: 'crimson' }}>Não foi possível carregar o fluxograma: {error}</p>}
      {Object.keys(byLane).length > 0 && (
        <div style={{ position: 'absolute', left: 16, top: 16, zIndex: 5, display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: '55%' }}>
          {process.lanes.filter((l) => byLane[l.id]).map((l) => (
            <button key={l.id} className="chip" aria-pressed={sel?.id === l.id} onClick={() => setSel({ id: l.id, type: 'lane' })}>Raia {l.name}: {byLane[l.id].length} medições</button>
          ))}
        </div>
      )}
      <div className="walkbox">
        {!walk ? (
          <button className="btn walk-start" onClick={() => setWalk({ nodes: [graph.startId], segs: [] })}>▶ Percorrer o fluxo escolhendo os caminhos</button>
        ) : (
          <div className="walk-panel">
            <b>{graph.node(walkCur!).name || (graph.isEnd(walkCur!) ? 'Fim do processo' : 'Início')}</b>
            {graph.isEnd(walkCur!) ? <span>Fim do percurso · {walk.nodes.length} passos</span>
              : walkOpts.length > 1 ? (<><span>Escolha o caminho:</span>{walkOpts.map((o) => <button key={o.to + o.label} className="chip" onClick={() => step1(o, walkCur!)}>{o.label || graph.node(o.to).name}</button>)}</>)
              : <button className="chip" aria-pressed="true" onClick={() => step1(autoNext(graph, walkCur!), walkCur!)}>Próximo passo →</button>}
            {walk.nodes.length > 1 && <button className="chip" onClick={() => setWalk({ nodes: walk.nodes.slice(0, -1), segs: walk.segs.slice(0, -1) })}>← Voltar</button>}
            <button className="chip" onClick={() => setWalk(null)}>Sair do percurso</button>
          </div>
        )}
      </div>
      <div className="zoomctl">
        <button aria-label="Aproximar" onClick={() => zoom(1.25)}>+</button>
        <button aria-label="Afastar" onClick={() => zoom(0.8)}>−</button>
        <button className="wide" onClick={() => zoom('fit')}>Centralizar</button>
      </div>
      <div className="hint">Arraste para mover · Ctrl + rolagem para zoom · clique em uma etapa</div>
      {tip && <div className="hover-tip" style={{ left: tip.x + 14, top: tip.y + 14 }}>{tip.text}</div>}
      {panel}
    </div>
  )
}
