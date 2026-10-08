import { useEffect, useMemo, useRef, useState } from 'react'
import { Dataset, JOURNEY, Step, fmt } from '../lib/data'

/* ------------------------------------------------------------------ modelo das paradas */
type Chip = { label: string; value: string; sub: string }
type Stop = {
  key: string; title: string; type: 'start' | 'task' | 'decision' | 'end' | 'step'
  lane: string; via?: string | null; chips: Chip[]; step?: Step
}
type Chapter = { id: string; nav: string; kicker: string; title: string; lead: string; stats: [string, string][]; stops: Stop[]; lanes: boolean }

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

function buildChapters(data: Dataset): Chapter[] {
  const { processes, m } = data
  const journey = JOURNEY(m.steps)
  const flowStops = (id: string): Stop[] => {
    const p = processes.find((x) => x.id === id)!
    const laneName = Object.fromEntries(p.lanes.map((l) => [l.id, l.name]))
    return [...p.nodes]
      .filter((n) => !(n.kind === 'exclusiveGateway' && !n.name))
      .sort((a, b) => a.seq - b.seq)
      .map((n): Stop => {
        const linked = m.steps.filter((s) => s.link.process === id && s.link.nodes.includes(n.id))
        return {
          key: n.id,
          title: n.name || (n.kind === 'startEvent' ? 'Início do processo' : 'Fim do processo'),
          type: n.kind === 'startEvent' ? 'start' : n.kind === 'endEvent' ? 'end' : n.kind === 'exclusiveGateway' ? 'decision' : 'task',
          lane: (n.lane && laneName[n.lane]) || '',
          via: n.via,
          chips: linked.map((s) => ({ label: s.label, value: fmt(s.mean), sub: `média de ${s.n} medições` })),
        }
      })
  }
  const g = processes.find((p) => p.id === 'glaucoma')!
  const c = processes.find((p) => p.id === 'exame-de-cornea')!
  const l = processes.find((p) => p.id === 'teste-de-lente')!
  const flowStats = (p: typeof g): [string, string][] => [[String(p.counts.tasks), 'tarefas'], [String(p.counts.gateways), 'decisões'], [String(p.counts.lanes), 'raias']]
  const totalN = journey.reduce((a, s) => a + s.n, 0)
  return [
    { id: 'glaucoma', nav: 'Glaucoma', kicker: 'Processo 1 de 3', title: 'Glaucoma', lead: 'O caminho do paciente, da portaria até ser liberado ou agendado.', stats: flowStats(g), stops: flowStops('glaucoma'), lanes: true },
    { id: 'tempos', nav: 'Glaucoma · tempos', kicker: 'Cronoanálise', title: 'Quanto tempo cada etapa leva', lead: 'As mesmas visitas, agora com o cronômetro: cada parada traz o tempo médio medido na clínica.',
      stats: [[String(journey.length), 'etapas'], [String(totalN), 'medições']],
      stops: journey.map((s): Stop => ({ key: s.id, title: s.label, type: 'step', lane: s.phase, chips: [], step: s })), lanes: true },
    { id: 'exame-de-cornea', nav: 'Córnea', kicker: 'Processo 2 de 3', title: 'Exame de córnea', lead: 'Da chegada na portaria à saída da clínica ou ao agendamento.', stats: flowStats(c), stops: flowStops('exame-de-cornea'), lanes: true },
    { id: 'teste-de-lente', nav: 'Teste de lente', kicker: 'Processo 3 de 3', title: 'Teste de lente', lead: 'A consulta de teste de lente, com a decisão de aprovar ou trocar a lente.', stats: flowStats(l), stops: flowStops('teste-de-lente'), lanes: true },
  ]
}

/* ------------------------------------------------------------------ o paciente */
function Patient() {
  return (
    <svg className="pt" viewBox="0 0 90 160" aria-hidden="true">
      <ellipse className="pt-shadow" cx="45" cy="154" rx="24" ry="4.5" />
      <g className="pt-body">
        <g className="leg la"><rect x="33" y="92" width="10" height="56" rx="5" /><rect x="31" y="143" width="17" height="7" rx="3.5" className="shoe" /></g>
        <g className="leg lb"><rect x="47" y="92" width="10" height="56" rx="5" /><rect x="45" y="143" width="17" height="7" rx="3.5" className="shoe" /></g>
        <g className="arm ab"><rect x="21" y="58" width="9" height="36" rx="4.5" className="sleeve" /></g>
        <rect x="28" y="54" width="34" height="44" rx="13" className="torso" />
        <g className="arm aa">
          <rect x="60" y="58" width="9" height="34" rx="4.5" className="sleeve" />
          <g className="ficha"><rect x="64" y="82" width="15" height="19" rx="2" /><path d="M67 88h9M67 92h9M67 96h6" /></g>
        </g>
        <circle cx="45" cy="34" r="19" className="head" />
        <path d="M27 30c2-12 12-17 20-16 9 1 15 8 16 16-6-6-14-9-22-8-5 1-10 4-14 8z" className="hair" />
        <circle cx="51" cy="36" r="2.2" className="eye" /><circle cx="61" cy="36" r="2.2" className="eye" />
        <path d="M52 44q4 3.4 8 0" className="smile" />
      </g>
    </svg>
  )
}

/* ------------------------------------------------------------------ range bar (tempo medido) */
function RangeBar({ s, lo, hi }: { s: Step; lo: number; hi: number }) {
  const L = (v: number) => (Math.log(Math.max(v, 1)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))
  const a = clamp(L(s.min)), b = clamp(L(s.max)), md = clamp(L(s.median))
  return (
    <div className="jr-range" aria-hidden="true">
      <i style={{ left: `${a * 100}%`, width: `${Math.max(2, (b - a) * 100)}%` }} />
      <b style={{ left: `${md * 100}%` }} />
    </div>
  )
}

/* ------------------------------------------------------------------ um capítulo (cena fixa que reage à rolagem) */
function ChapterScene({ ch, index, names, lo, hi, go }: { ch: Chapter; index: number; names: string[]; lo: number; hi: number; go: (i: number) => void }) {
  const total = names.length
  const outer = useRef<HTMLElement>(null), world = useRef<HTMLDivElement>(null), patient = useRef<HTMLDivElement>(null)
  const trail = useRef<HTMLDivElement>(null), intro = useRef<HTMLDivElement>(null), bar = useRef<HTMLDivElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([]), dots = useRef<(HTMLSpanElement | null)[]>([])
  const [vw, setVw] = useState(() => window.innerWidth)
  const [active, setActive] = useState(0)
  const n = ch.stops.length
  const S = Math.round(clamp(vw * 0.84, 300, 400))        // distância entre paradas
  const anchor = vw < 760 ? vw / 2 : vw * 0.3             // onde o paciente fica na tela
  const T = n - 1 + 1.7                                     // “unidades” de rolagem: abertura (1) + percurso + saída (.7)
  const heightVh = T * 36 + 100

  // setores (raias) = trechos consecutivos na mesma raia
  const rooms = useMemo(() => {
    const r: { lane: string; from: number; to: number }[] = []
    ch.stops.forEach((s, i) => { const last = r[r.length - 1]; if (last && last.lane === s.lane) last.to = i; else r.push({ lane: s.lane, from: i, to: i }) })
    return r
  }, [ch])

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth)
    window.addEventListener('resize', onResize); return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    let raf = 0, prev = -1, lastActive = -1, walkTimer = 0
    const frame = () => {
      raf = 0
      const el = outer.current; if (!el) return
      const rect = el.getBoundingClientRect(), vh = window.innerHeight
      if (rect.bottom < -vh || rect.top > vh * 2) return
      const span = rect.height - vh
      const p = span > 0 ? clamp(-rect.top / span) : 0
      const u = p * T
      const x = clamp(u - 1, 0, n - 1)
      const seg = Math.min(Math.floor(x), n - 2), t = x - seg
      const pos = n === 1 ? 0 : seg + smooth(clamp((t - 0.2) / 0.6))
      // câmera
      world.current!.style.transform = `translate3d(${anchor - pos * S}px,0,0)`
      world.current!.parentElement!.style.setProperty('--cam', `${-pos * S}px`)
      trail.current!.style.transform = `scaleX(${n > 1 ? pos / (n - 1) : 0})`
      bar.current!.style.transform = `scaleX(${p})`
      const iu = smooth(clamp(u / 0.9))
      world.current!.style.opacity = String(clamp(iu * 1.3 - 0.15))
      intro.current!.style.opacity = String(1 - iu)
      intro.current!.style.transform = `translateY(${-iu * 36}px)`
      intro.current!.style.visibility = iu > 0.98 ? 'hidden' : 'visible'
      for (let i = 0; i < n; i++) {
        const k = smooth(clamp(1 - Math.abs(i - pos) / 1.1))
        cards.current[i]?.style.setProperty('--k', k.toFixed(3))
        dots.current[i]?.classList.toggle('done', i <= pos + 0.02)
      }
      const a = Math.round(pos)
      if (a !== lastActive) { lastActive = a; setActive(a) }
      if (prev >= 0 && Math.abs(pos - prev) > 0.0004) {
        patient.current?.classList.add('walking'); window.clearTimeout(walkTimer)
        walkTimer = window.setTimeout(() => patient.current?.classList.remove('walking'), 140)
      }
      prev = pos
    }
    const req = () => { if (!raf) raf = requestAnimationFrame(frame) }
    window.addEventListener('scroll', req, { passive: true }); window.addEventListener('resize', req); req()
    return () => { window.removeEventListener('scroll', req); window.removeEventListener('resize', req); cancelAnimationFrame(raf); window.clearTimeout(walkTimer) }
  }, [n, S, anchor, T])

  const cur = ch.stops[Math.min(active, n - 1)]
  return (
    <section ref={outer} id={`jornada-${ch.id}`} className="jr-outer" style={{ height: `${heightVh}vh` }} aria-label={`Animação: ${ch.title}`}>
      <div className="jr-stage" style={{ ['--S' as string]: `${S}px` }}>
        <div className="jr-bg b1" /><div className="jr-bg b2" />

        <header className="jr-hud">
          <nav className="jr-chips" aria-label="Capítulos">
            {Array.from({ length: total }).map((_, i) => (
              <button key={i} className={i === index ? 'on' : ''} onClick={() => go(i)} aria-current={i === index ? 'step' : undefined}>
                <span className="num">{i + 1}</span><em>{names[i]}</em>
              </button>
            ))}
          </nav>
          <div className="jr-count num" aria-live="polite">
            <b>{String(Math.min(active + 1, n)).padStart(2, '0')}</b><span> / {String(n).padStart(2, '0')}</span>
          </div>
          <div className="jr-progress"><div ref={bar} /></div>
        </header>

        <div className="jr-intro" ref={intro}>
          <p className="kicker" style={{ color: 'var(--color-iris-2)' }}>{ch.kicker}</p>
          <h2>{ch.title}</h2>
          <p className="lead">{ch.lead}</p>
          <ul className="jr-stats">{ch.stats.map(([v, l]) => <li key={l}><b className="num">{v}</b><span>{l}</span></li>)}</ul>
          <div className="jr-cue" aria-hidden="true"><i /><span>role para o paciente começar a andar</span></div>
        </div>

        <div className="jr-area">
          <div className="jr-world" ref={world} style={{ width: (n - 1) * S + 2 * S }}>
            {ch.lanes && rooms.map((r, i) => (
              <div key={i} className={`jr-room ${i % 2 ? 'alt' : ''}`} style={{ left: (r.from - 0.5) * S, width: (r.to - r.from + 1) * S }}>
                <span>{r.lane}</span>
              </div>
            ))}
            <div className="jr-floor"><div ref={trail} className="jr-trail" style={{ width: (n - 1) * S }} /></div>
            {ch.stops.map((s, i) => (
              <div key={s.key} className="jr-stop" style={{ left: i * S }}>
                <span ref={(e) => { dots.current[i] = e }} className={`jr-dot ${s.type}`}><i className="num">{i + 1}</i></span>
                <div ref={(e) => { cards.current[i] = e }} className={`jr-card ${s.type} ${i === active ? 'on' : ''}`} style={{ width: S - 36 }}>
                  <div className="jr-tag">
                    <span>{s.type === 'start' ? 'Início' : s.type === 'end' ? 'Fim' : s.type === 'decision' ? 'Decisão' : s.type === 'step' ? 'Etapa medida' : 'Etapa'}</span>
                    {s.lane && <em>{s.lane}</em>}
                    {s.via && <em className="via">se: {s.via}</em>}
                  </div>
                  <h3>{s.title}</h3>
                  {s.step && (
                    <div className="jr-measure">
                      <div className="big num">{fmt(s.step.mean)}</div>
                      <div className="cap">tempo médio · {s.step.n} medições</div>
                      <RangeBar s={s.step} lo={lo} hi={hi} />
                      <div className="mm num"><span>menor {fmt(s.step.min)}</span><span>mediana {fmt(s.step.median)}</span><span>maior {fmt(s.step.max)}</span></div>
                    </div>
                  )}
                  {s.chips.map((c) => (
                    <div key={c.label} className="jr-chip"><span>{c.label}</span><b className="num">{c.value}</b><small>{c.sub}</small></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="jr-patient" ref={patient} style={{ left: anchor }}><div className="bob"><Patient /></div></div>
        </div>

        <footer className="jr-foot">
          <span className="jr-now">{cur?.title}</span>
          {index < total - 1 && <button className="jr-skip" onClick={() => go(index + 1)}>Pular capítulo ↓</button>}
        </footer>
        <ol className="sr-only">{ch.stops.map((s) => <li key={s.key}>{s.title}</li>)}</ol>
      </div>
    </section>
  )
}

export default function Journey({ data }: { data: Dataset }) {
  const chapters = useMemo(() => buildChapters(data), [data])
  const names = chapters.map((c) => c.nav)
  const journey = JOURNEY(data.m.steps)
  const lo = Math.min(...journey.map((s) => Math.max(s.min, 1))), hi = Math.max(...journey.map((s) => s.max))
  const go = (i: number) => document.getElementById(`jornada-${chapters[i].id}`)?.scrollIntoView({ behavior: 'smooth' })
  return (
    <div id="jornada">
      <section className="section" style={{ paddingBottom: 40 }}>
        <div className="wrap">
          <p className="kicker">A jornada do paciente</p>
          <h2 className="h2">Acompanhe o paciente por dentro da clínica</h2>
          <p className="lead measure">Role a página: o paciente caminha por cada etapa dos três processos mapeados — e, no caso do Glaucoma, mostra quanto tempo cada uma leva, segundo as medições da cronoanálise.</p>
        </div>
      </section>
      {chapters.map((c, i) => <ChapterScene key={c.id} ch={c} index={i} names={names} lo={lo} hi={hi} go={go} />)}
    </div>
  )
}
