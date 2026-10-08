import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Dataset, JOURNEY, Process, Step, fmt } from '../lib/data'
import { Graph, Option, autoNext, makeGraph, restarts } from '../lib/walk'
import Patient, { LOOKS, Look } from './Patient'
import '../patient.css'
import '../journey.css'

/* ------------------------------------------------------------------ modelo */
type Chip = { label: string; value: string; sub: string }
type Kind = 'start' | 'task' | 'decision' | 'end' | 'step'
type Visit = { key: string; nodeId: string; via: string | null; pick?: string }
type Stop = { title: string; kind: Kind; lane: string; via: string | null; chips: Chip[]; step?: Step; note?: string }
type Chapter = {
  id: string; nav: string; kicker: string; title: string; lead: string
  stats: [string, string][]; mode: 'flow' | 'timed'
  proc?: Process; graph?: Graph; steps?: Step[]
}

const CYCLE = '__ciclo'
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)
const optKey = (o: Option) => `${o.label || ''}|${o.to}`

function smoothDamp(cur: number, target: number, vel: number, smoothTime: number, maxSpeed: number, dt: number): [number, number] {
  const omega = 2 / smoothTime, x = omega * dt
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x)
  const maxChange = maxSpeed * smoothTime
  const change = clamp(cur - target, -maxChange, maxChange)
  const t2 = cur - change
  const temp = (vel + omega * change) * dt
  let nv = (vel - omega * temp) * e
  let out = t2 + (change + temp) * e
  if (target - cur > 0 === out > target) { out = target; nv = 0 }
  return [out, nv]
}

function buildChapters(data: Dataset): Chapter[] {
  const { processes, m } = data
  const journey = JOURNEY(m.steps)
  const totalN = journey.reduce((a, s) => a + s.n, 0)
  const flow = (id: string, nav: string, kicker: string, lead: string): Chapter => {
    const p = processes.find((x) => x.id === id)!
    return {
      id, nav, kicker, title: p.title, lead, mode: 'flow', proc: p, graph: makeGraph(p),
      stats: [[String(p.counts.tasks), 'etapas'], [String(p.counts.gateways), 'decisões'], [String(p.counts.lanes), 'equipes']],
    }
  }
  return [
    flow('glaucoma', 'Glaucoma', 'Processo 1 de 3', 'Da chegada com o encaminhamento até a liberação ou o agendamento.'),
    flow('exame-de-cornea', 'Córnea', 'Processo 2 de 3', 'Da portaria à saída da clínica — ou ao setor de marcação.'),
    flow('teste-de-lente', 'Teste de lente', 'Processo 3 de 3', 'A consulta de teste de lente, com a decisão de aprovar ou trocar a lente.'),
    {
      id: 'tempos', nav: 'Glaucoma · tempos', kicker: 'Cronoanálise', title: 'Quanto tempo cada etapa leva',
      lead: 'As etapas do Glaucoma, uma a uma, com o tempo médio medido na clínica.', mode: 'timed', steps: journey,
      stats: [[String(journey.length), 'etapas'], [String(totalN), 'medições']],
    },
  ]
}

/* ------------------------------------------------------------------ barra de variação */
function RangeBar({ s, lo, hi }: { s: Step; lo: number; hi: number }) {
  const L = (v: number) => (Math.log(Math.max(v, 1)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
  const a = clamp(L(s.min)), b = clamp(L(s.max)), md = clamp(L(s.median))
  return (
    <div className="jx-range" aria-hidden="true">
      <i style={{ left: `${a * 100}%`, width: `${Math.max(2, (b - a) * 100)}%` }} />
      <b style={{ left: `${md * 100}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ uma corrida (capítulo em andamento) */
function Run({ ch, data, look, lo, hi, onExit, visible }: { ch: Chapter; data: Dataset; look: Look; lo: number; hi: number; onExit: () => void; visible: boolean }) {
  const g = ch.graph
  const steps = data.m.steps

  const initial = useMemo<Visit[]>(() => {
    if (ch.mode === 'timed') return ch.steps!.map((s) => ({ key: s.id, nodeId: s.id, via: null }))
    return [{ key: 'v0', nodeId: g!.startId, via: null }]
  }, [ch, g])

  const [trail, setTrail] = useState<Visit[]>(initial)
  const [cursor, setCursor] = useState(0)
  const [auto, setAuto] = useState(false)
  const [arrived, setArrived] = useState(true)
  const [vw, setVw] = useState(() => window.innerWidth)
  const [vh, setVh] = useState(() => window.innerHeight)

  const stage = useRef<HTMLDivElement>(null), world = useRef<HTMLDivElement>(null), patient = useRef<HTMLDivElement>(null), lean = useRef<HTMLDivElement>(null)
  const trailLine = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([]), dots = useRef<(HTMLSpanElement | null)[]>([])
  const live = useRef({ target: 0, S: 360, anchor: 400, n: 1 })
  const idSeq = useRef(1)

  const S = Math.round(clamp(vw * 0.86, 300, 430))
  const anchor = vw < 760 ? vw * 0.5 : Math.min(vw * 0.3, 460)
  const u = clamp(vh / 860, 0.62, 1)
  const n = trail.length
  live.current.target = cursor; live.current.S = S; live.current.anchor = anchor; live.current.n = n

  useEffect(() => {
    const on = () => { setVw(window.innerWidth); setVh(stage.current?.clientHeight || window.innerHeight) }
    on(); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on)
  }, [])

  /* ---- descrição de cada parada ---- */
  const stopOf = useCallback((v: Visit): Stop => {
    if (ch.mode === 'timed') {
      const s = ch.steps!.find((x) => x.id === v.nodeId)!
      return { title: s.label, kind: 'step', lane: s.phase, via: null, chips: [], step: s }
    }
    if (v.nodeId === CYCLE) {
      return { title: 'O ciclo recomeça', kind: 'end', lane: '', via: v.via, chips: [], note: `O paciente volta ao começo do fluxo (“${g!.node(g!.firstId).name}”) para uma nova propedêutica.` }
    }
    const nd = g!.node(v.nodeId)
    const laneName = ch.proc!.lanes.find((l) => l.id === nd.lane)?.name || ''
    const linked = steps.filter((s) => s.link.process === ch.id && s.link.nodes.includes(nd.id))
    const kind: Kind = nd.kind === 'startEvent' ? 'start' : nd.kind === 'endEvent' ? 'end' : nd.kind === 'exclusiveGateway' ? 'decision' : 'task'
    return {
      title: nd.name || (kind === 'start' ? 'Início do processo' : 'Fim do processo'), kind, lane: laneName, via: v.via,
      chips: linked.map((s) => ({ label: s.label, value: fmt(s.mean), sub: `média de ${s.n} medições` })),
    }
  }, [ch, g, steps])

  const stops = useMemo(() => trail.map(stopOf), [trail, stopOf])
  const cur = stops[Math.min(cursor, n - 1)]
  const curVisit = trail[Math.min(cursor, n - 1)]

  /* ---- saídas do passo atual ---- */
  const options = useMemo<Option[]>(() => (ch.mode === 'flow' && curVisit && curVisit.nodeId !== CYCLE && g!.isDecision(curVisit.nodeId) ? g!.out(curVisit.nodeId) : []), [ch, g, curVisit])
  const atTail = cursor === n - 1
  const isEnd = atTail && (cur.kind === 'end' || ch.mode === 'timed')
  const waiting = options.length > 1 && atTail
  const revisiting = options.length > 1 && !atTail
  const canNext = !isEnd && !waiting && (ch.mode === 'timed' ? cursor < n - 1 : true)
  const decisions = trail.filter((v, i) => i < cursor + 1 && v.pick).length

  const pushVisit = useCallback((base: Visit[], at: number, o: Option, pick?: string) => {
    const next = base.slice(0, at + 1)
    if (pick) next[at] = { ...next[at], pick }
    const dest = restarts(g!, o, base[at].nodeId) ? CYCLE : o.to
    next.push({ key: `v${idSeq.current++}`, nodeId: dest, via: o.label })
    return next
  }, [g])

  const advance = useCallback(() => {
    if (cursor < trail.length - 1) { setCursor(cursor + 1); return }
    if (ch.mode === 'timed' || isEnd || waiting) return
    const o = autoNext(g!, trail[cursor].nodeId)
    if (!o) return
    setTrail(pushVisit(trail, cursor, o)); setCursor(cursor + 1)
  }, [cursor, trail, ch, g, isEnd, waiting, pushVisit])

  const choose = useCallback((o: Option) => {
    const key = optKey(o)
    if (cursor < trail.length - 1 && trail[cursor].pick === key) { setCursor(cursor + 1); return }
    setTrail(pushVisit(trail, cursor, o, key)); setCursor(cursor + 1)
  }, [cursor, trail, pushVisit])

  const back = useCallback(() => setCursor((c) => Math.max(0, c - 1)), [])
  const restart = useCallback(() => { setTrail(initial); setCursor(0); setAuto(false) }, [initial])

  /* ---- animador: a câmera e o paciente seguem “pos” com amortecimento ---- */
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0, last = performance.now(), pos = live.current.target, vel = 0, wasMoving = false, wasArrived = true
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (t - last) / 1000); last = t
      const L = live.current
      if (reduce) { pos = L.target; vel = 0 } else [pos, vel] = smoothDamp(pos, L.target, vel, 0.42, 1.55, Math.max(dt, 0.001))
      const dist = Math.abs(L.target - pos)
      const moving = Math.abs(vel) > 0.06 || dist > 0.015
      world.current && (world.current.style.transform = `translate3d(${L.anchor - pos * L.S}px,0,0)`)
      stage.current && stage.current.style.setProperty('--cam', `${-pos * L.S}px`)
      trailLine.current && (trailLine.current.style.transform = `scaleX(${L.n > 1 ? clamp(pos / (L.n - 1)) : 0})`)
      lean.current && (lean.current.style.transform = `translateX(-50%) rotate(${clamp(vel * 2.4, -4, 5).toFixed(2)}deg)`)
      if (moving !== wasMoving) { wasMoving = moving; patient.current?.classList.toggle('walking', moving && !reduce) }
      const settled = !moving
      if (settled !== wasArrived) { wasArrived = settled; setArrived(settled) }
      for (let i = 0; i < L.n; i++) {
        const k = smooth(clamp(1 - Math.abs(i - pos) / 1.25))
        cards.current[i]?.style.setProperty('--k', k.toFixed(3))
        dots.current[i]?.classList.toggle('done', i <= pos + 0.02)
      }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  /* ---- poses ---- */
  useEffect(() => {
    const el = patient.current; if (!el) return
    el.classList.toggle('thinking', arrived && waiting)
    el.classList.toggle('cheer', arrived && isEnd)
  }, [arrived, waiting, isEnd])

  /* ---- reprodução automática ---- */
  useEffect(() => {
    if (!auto || !visible || !arrived || waiting || isEnd) return
    if (ch.mode === 'timed' && cursor >= n - 1) { setAuto(false); return }
    const id = window.setTimeout(advance, 1300)
    return () => window.clearTimeout(id)
  }, [auto, visible, arrived, waiting, isEnd, advance, ch, cursor, n])
  useEffect(() => { if (isEnd) setAuto(false) }, [isEnd])

  /* ---- teclado (setas e 1/2/3 valem com a seção na tela) ---- */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {})
  keyRef.current = (e) => {
    const t = e.target as HTMLElement | null
    if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return
    if (e.key === 'ArrowRight') { e.preventDefault(); if (canNext) advance() }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); back() }
    else if ((e.key === '1' || e.key === '2' || e.key === '3') && options[Number(e.key) - 1] && waiting) choose(options[Number(e.key) - 1])
  }
  useEffect(() => {
    if (!visible) return
    const on = (e: KeyboardEvent) => keyRef.current(e)
    window.addEventListener('keydown', on); return () => window.removeEventListener('keydown', on)
  }, [visible])

  /* ---- salas (trechos consecutivos na mesma equipe) ---- */
  const rooms = useMemo(() => {
    const r: { lane: string; from: number; to: number }[] = []
    stops.forEach((s, i) => { const last = r[r.length - 1]; if (last && last.lane === s.lane) last.to = i; else r.push({ lane: s.lane, from: i, to: i }) })
    return r
  }, [stops])

  /* caminhos não escolhidos em decisões já tomadas */
  const alts = useMemo(() => {
    if (ch.mode !== 'flow') return {} as Record<number, { label: string; to: string }[]>
    const out: Record<number, { label: string; to: string }[]> = {}
    trail.forEach((v, i) => {
      if (!v.pick || v.nodeId === CYCLE || i >= cursor + 1) return
      const rest = g!.out(v.nodeId).filter((o) => optKey(o) !== v.pick)
      if (rest.length) out[i] = rest.map((o) => ({ label: o.label || 'Outro caminho', to: restarts(g!, o, v.nodeId) ? 'Recomeça o ciclo' : g!.node(o.to).name }))
    })
    return out
  }, [trail, cursor, ch, g])

  const typeLabel = (k: Kind) => (k === 'start' ? 'Início' : k === 'end' ? 'Fim' : k === 'decision' ? 'Decisão' : k === 'step' ? 'Etapa medida' : 'Etapa')

  return (
    <div className={`jx-stage ${waiting ? 'is-waiting' : ''}`} ref={stage} style={{ ['--S' as string]: `${S}px`, ['--u' as string]: u, ['--cam' as string]: '0px' }}
      aria-label={`Jornada: ${ch.title}. Use as setas do teclado para avançar e voltar.`}>
      <Backdrop />

      <header className="jx-hud">
        <div className="jx-hud-l">
          <span className="jx-kicker">{ch.kicker}</span>
          <b className="jx-title">{ch.title}</b>
        </div>
        <ol className="jx-mini" aria-label="Caminho percorrido">
          {trail.map((v, i) => (
            <li key={v.key}>
              <button className={`${stops[i].kind} ${i === cursor ? 'cur' : ''} ${i < cursor ? 'past' : ''}`} onClick={() => setCursor(i)} aria-label={`Ir para: ${stops[i].title}`} title={stops[i].title} />
            </li>
          ))}
        </ol>
        <div className="jx-count num" aria-live="polite">
          <b>{String(cursor + 1).padStart(2, '0')}</b>
          <span>{ch.mode === 'timed' ? ` / ${String(n).padStart(2, '0')}` : decisions ? ` · ${decisions} ${decisions === 1 ? 'decisão' : 'decisões'}` : ''}</span>
        </div>
      </header>

      <div className="jx-area">
        <div className="jx-world" ref={world} style={{ width: (n + 1) * S }}>
          {rooms.map((r, i) => (
            <div key={i} className={`jx-room ${i % 2 ? 'alt' : ''}`} style={{ left: (r.from - 0.5) * S, width: (r.to - r.from + 1) * S }}>
              <span>{r.lane}</span>
            </div>
          ))}
          <div className="jx-floor"><div ref={trailLine} className="jx-trail" style={{ width: Math.max(0, (n - 1) * S) }} /></div>
          {stops.map((s, i) => (
            <div key={trail[i].key} className="jx-stop" style={{ left: i * S }}>
              <span ref={(e) => { dots.current[i] = e }} className={`jx-dot ${s.kind}`}><i className="num">{i + 1}</i></span>
              <div ref={(e) => { cards.current[i] = e }} className={`jx-card ${s.kind} ${i === cursor ? 'on' : ''}`} style={{ width: S - 44 }}>
                <div className="jx-tag">
                  <span>{typeLabel(s.kind)}</span>
                  {s.lane && <em>{s.lane}</em>}
                  {s.via && <em className="via">{s.kind === 'decision' || i === 0 ? '' : 'escolha: '}{s.via}</em>}
                </div>
                <h3>{s.title}</h3>
                {s.note && <p className="jx-note">{s.note}</p>}
                {s.step && (
                  <div className="jx-measure">
                    <div className="big num">{fmt(s.step.mean)}</div>
                    <div className="cap">tempo médio · {s.step.n} medições</div>
                    <RangeBar s={s.step} lo={lo} hi={hi} />
                    <div className="mm num"><span>menor {fmt(s.step.min)}</span><span>mediana {fmt(s.step.median)}</span><span>maior {fmt(s.step.max)}</span></div>
                  </div>
                )}
                {s.chips.map((c) => (
                  <div key={c.label} className="jx-chip"><span>{c.label}</span><b className="num">{c.value}</b><small>{c.sub}</small></div>
                ))}
                {i === cursor && (waiting || revisiting) && (
                  <div className="jx-choices" role="group" aria-label="Escolha o caminho">
                    <p>{waiting ? 'Qual caminho o paciente segue?' : 'Você já escolheu aqui. Quer mudar de caminho?'}</p>
                    {options.map((o, k) => (
                      <button key={optKey(o)} className={`jx-opt ${trail[i].pick === optKey(o) ? 'picked' : ''}`} onClick={() => choose(o)}>
                        <kbd>{k + 1}</kbd>
                        <span><b>{o.label || (restarts(g!, o, trail[i].nodeId) ? 'Recomeça o ciclo' : g!.node(o.to).name)}</b>{o.label && <small>{restarts(g!, o, trail[i].nodeId) ? 'Recomeça o ciclo' : g!.node(o.to).name}</small>}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {alts[i] && (
                <button className="jx-alt" onClick={() => setCursor(i)} title="Voltar a esta decisão e escolher outro caminho">
                  <i /> não seguiu: {alts[i].map((a) => `${a.label} → ${a.to}`).join(' · ')}
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="jx-patient" ref={patient} style={{ left: anchor }}>
          <div className="lean" ref={lean}><Patient look={look} /></div>
        </div>
      </div>

      <footer className="jx-dock">
        <div className="jx-dock-l">
          <button className="jx-btn ghost" onClick={back} disabled={cursor === 0} aria-label="Etapa anterior">← Voltar</button>
          <button className={`jx-btn ghost ${auto ? 'on' : ''}`} onClick={() => setAuto((a) => !a)} disabled={isEnd || waiting} aria-pressed={auto}>{auto ? '❚❚ Pausar' : '▶ Automático'}</button>
        </div>
        <div className="jx-dock-c">
          {waiting ? (
            <div className="jx-dock-choices">
              <span>Escolha o caminho:</span>
              {options.map((o, k) => (
                <button key={optKey(o)} className="jx-btn primary" onClick={() => choose(o)}>{o.label || g!.node(o.to).name.slice(0, 28)}<kbd>{k + 1}</kbd></button>
              ))}
            </div>
          ) : isEnd ? (
            <div className="jx-dock-choices">
              <button className="jx-btn primary" onClick={restart}>↺ Refazer com outro caminho</button>
              {ch.mode === 'flow' && <a className="jx-btn ghost" href={`#/processo/${ch.id}`}>Abrir fluxograma completo →</a>}
              <button className="jx-btn ghost" onClick={onExit}>Escolher outro processo</button>
            </div>
          ) : (
            <button className="jx-btn primary big" onClick={advance} disabled={!canNext}>Avançar →</button>
          )}
        </div>
        <div className="jx-dock-r">
          <button className="jx-btn ghost" onClick={restart}>↺ Reiniciar</button>
          <button className="jx-btn ghost" onClick={onExit}>Processos</button>
        </div>
      </footer>
      <ol className="sr-only">{stops.map((s, i) => <li key={i}>{s.title}</li>)}</ol>
    </div>
  )
}

/* cenário em camadas (paralaxe controlada por --cam) */
function Backdrop() {
  return (
    <>
      <div className="jx-bg l0" /><div className="jx-bg l1" /><div className="jx-bg l2" />
    </>
  )
}

/* ------------------------------------------------------------------ seção */
export default function Journey({ data }: { data: Dataset }) {
  const chapters = useMemo(() => buildChapters(data), [data])
  const journey = JOURNEY(data.m.steps)
  const lo = Math.min(...journey.map((s) => Math.max(s.min, 1))), hi = Math.max(...journey.map((s) => s.max))
  const [chapter, setChapter] = useState<number | null>(null)
  const [look, setLook] = useState<Look>(() => { try { return (localStorage.getItem('look') as Look) || 'a' } catch { return 'a' } })
  const [visible, setVisible] = useState(false)
  const root = useRef<HTMLElement>(null)
  useEffect(() => { try { localStorage.setItem('look', look) } catch { /* sem armazenamento */ } }, [look])
  useEffect(() => {
    const el = root.current; if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.35 }); io.observe(el)
    return () => io.disconnect()
  }, [])
  /* o botão “Iniciar jornada” da abertura chega aqui */
  useEffect(() => {
    const on = () => { root.current?.scrollIntoView({ behavior: 'smooth' }); setChapter(0) }
    window.addEventListener('iniciar-jornada', on); return () => window.removeEventListener('iniciar-jornada', on)
  }, [])

  const ch = chapter == null ? null : chapters[chapter]
  return (
    <section ref={root} id="jornada" className="jx" aria-label="Jornada do paciente">
      {ch ? (
        <>
          <nav className="jx-tabs" aria-label="Processos">
            {chapters.map((c, i) => (
              <button key={c.id} className={i === chapter ? 'on' : ''} onClick={() => setChapter(i)} aria-current={i === chapter ? 'step' : undefined}>
                <span className="num">{i + 1}</span><em>{c.nav}</em>
              </button>
            ))}
            <span className="jx-looks" role="group" aria-label="Escolha o paciente">
              {LOOKS.map((l) => <button key={l.id} className={look === l.id ? 'on' : ''} onClick={() => setLook(l.id)} aria-pressed={look === l.id} title={`Paciente: ${l.name}`}><i data-look={l.id} /></button>)}
            </span>
          </nav>
          <Run key={ch.id} ch={ch} data={data} look={look} lo={lo} hi={hi} visible={visible} onExit={() => setChapter(null)} />
        </>
      ) : (
        <div className="jx-start">
          <div className="jx-bg l0" /><div className="jx-bg l1" />
          <div className="jx-start-in">
            <div className="jx-start-copy">
              <p className="kicker" style={{ color: 'var(--color-iris-2)' }}>A jornada do paciente</p>
              <h2>Percorra o fluxo como se fosse o paciente</h2>
              <p className="lead">Avance etapa por etapa. Sempre que o fluxograma tem uma decisão, é você quem escolhe o caminho — e pode voltar para ver o que teria acontecido no outro.</p>
              <div className="jx-pick">
                <span>Quem vai percorrer?</span>
                {LOOKS.map((l) => <button key={l.id} className={look === l.id ? 'on' : ''} onClick={() => setLook(l.id)} aria-pressed={look === l.id}><i data-look={l.id} />{l.name}</button>)}
              </div>
            </div>
            <div className="jx-hero-pt"><div className="stand"><Patient look={look} /></div></div>
            <div className="jx-chapters">
              {chapters.map((c, i) => (
                <button key={c.id} className="jx-chap" onClick={() => setChapter(i)}>
                  <span className="k">{c.kicker}</span>
                  <b>{c.title}</b>
                  <span className="l">{c.lead}</span>
                  <span className="s">{c.stats.map(([v, l]) => <em key={l}><b className="num">{v}</b> {l}</em>)}</span>
                  <span className="go">Iniciar <i>→</i></span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
