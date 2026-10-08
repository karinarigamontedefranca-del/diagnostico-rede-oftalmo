import { useEffect, useMemo, useRef, useState } from 'react'
import { Step, fmt } from '../lib/data'
import { goProcess } from '../lib/router'
import { Reveal } from './Reveal'

type Metric = 'mean' | 'median' | 'max' | 'n'
const METRICS: { id: Metric; label: string; hint: string }[] = [
  { id: 'mean', label: 'Tempo médio', hint: 'Média de todas as medições da etapa. A marca escura é a mediana.' },
  { id: 'median', label: 'Mediana', hint: 'O valor do meio: metade das medições é mais rápida, metade mais lenta.' },
  { id: 'max', label: 'Maior tempo', hint: 'O caso mais longo já observado em cada etapa.' },
  { id: 'n', label: 'Nº de medições', hint: 'Quantos pacientes foram cronometrados. Quanto menor, mais cautela com a média.' },
]
const RH = 46

/** Gráfico que reordena e redesenha as barras conforme a leitura escolhida — e muda sozinho conforme a rolagem avança. */
export default function Explorer({ steps }: { steps: Step[] }) {
  const [metric, setMetric] = useState<Metric>('mean')
  const [hover, setHover] = useState<string | null>(null)
  const val = (s: Step, m: Metric) => (m === 'n' ? s.n : s[m])
  const order = useMemo(() => [...steps].sort((a, b) => val(b, metric) - val(a, metric)), [steps, metric])
  const rank = (id: string) => order.findIndex((s) => s.id === id)
  const maxV = val(order[0], metric)
  const show = (v: number) => (metric === 'n' ? String(v) : fmt(v, { compact: true }))
  const maxMean = Math.max(...steps.map((s) => s.mean))

  // textos da rolagem — todos calculados a partir dos dados
  const beats = useMemo(() => {
    const byMean = [...steps].sort((a, b) => b.mean - a.mean)
    const skew = [...steps].filter((s) => s.n >= 10).sort((a, b) => b.mean / Math.max(b.median, 1) - a.mean / Math.max(a.median, 1))[0]
    const byMax = [...steps].sort((a, b) => b.max - a.max)[0]
    const byN = [...steps].sort((a, b) => b.n - a.n)
    const fewest = byN[byN.length - 1]
    return [
      { metric: 'mean' as Metric, kick: '1 · Onde o tempo se concentra', title: `${byMean[0].label} lidera: ${fmt(byMean[0].mean)} em média`, text: `Em ${byMean[0].n} medições, é a etapa mais longa do processo de Glaucoma. ${byMean[1].label} vem logo atrás, com ${fmt(byMean[1].mean)}.` },
      { metric: 'median' as Metric, kick: '2 · Média ou mediana?', title: `Em ${skew.label}, a média passa em ${Math.round((skew.mean / skew.median - 1) * 100)}% a mediana`, text: `A média é ${fmt(skew.mean)}, a mediana ${fmt(skew.median)}: poucos atendimentos longos puxam a média para cima. A mediana mostra o que é típico.` },
      { metric: 'max' as Metric, kick: '3 · Os casos extremos', title: `O maior tempo individual: ${fmt(byMax.max)}`, text: `Aconteceu em ${byMax.label}. Já o menor tempo médio, ${fmt(byMean[byMean.length - 1].mean)}, é de ${byMean[byMean.length - 1].label}.` },
      { metric: 'n' as Metric, kick: '4 · Quanto confiar em cada número', title: `${byN[0].label} tem ${byN[0].n} medições; ${fewest.label}, só ${fewest.n}`, text: 'Etapas com poucas medições pedem cautela: um único caso muda a média. As próximas coletas miram justamente essas etapas.' },
    ]
  }, [steps])

  const beatRefs = useRef<(HTMLDivElement | null)[]>([])
  const [active, setActive] = useState(0)
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { const i = beatRefs.current.indexOf(e.target as HTMLDivElement); if (i >= 0) { setActive(i); setMetric(beats[i].metric) } } }), { rootMargin: '-42% 0px -42% 0px' })
    beatRefs.current.forEach((el) => el && io.observe(el)); return () => io.disconnect()
  }, [beats])

  return (
    <div className="ex">
      <div className="ex-chart figure">
        <div className="ex-chips" role="group" aria-label="Como ler o gráfico">
          {METRICS.map((m) => <button key={m.id} className="chip" aria-pressed={metric === m.id} onClick={() => setMetric(m.id)}>{m.label}</button>)}
        </div>
        <p className="cap" style={{ margin: '12px 0 14px', minHeight: 44 }}>{METRICS.find((m) => m.id === metric)!.hint}</p>
        <div className="ex-rows" style={{ height: steps.length * RH }}>
          {steps.map((s) => (
            <button key={s.id} className={`ex-row ${hover === s.id ? 'hov' : ''}`} style={{ transform: `translateY(${rank(s.id) * RH}px)` }} onClick={() => goProcess('glaucoma', s.id)}
              onMouseEnter={() => setHover(s.id)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(s.id)} onBlur={() => setHover(null)}
              title={`${s.label}: média ${fmt(s.mean)} · mediana ${fmt(s.median)} · menor ${fmt(s.min)} · maior ${fmt(s.max)} · ${s.n} medições`}>
              <span className="lab">{s.label}</span>
              <span className="track">
                <span className="fill" style={{ width: `${(val(s, metric) / maxV) * 100}%`, background: metric === 'n' ? '#8b90b5' : undefined }} />
                {metric === 'mean' && <span className="tick" style={{ left: `calc(${(s.median / maxV) * 100}% - 1px)` }} />}
              </span>
              <span className="val num">{show(val(s, metric))}</span>
            </button>
          ))}
        </div>
        <p className="ex-foot">Clique em uma etapa para abrir suas medições. {metric === 'mean' && `Escala até ${fmt(maxMean, { compact: true })}.`}</p>
      </div>

      <div className="ex-beats">
        {beats.map((b, i) => (
          <div key={b.metric} ref={(e) => { beatRefs.current[i] = e }} className={`beat ${active === i ? 'on' : ''}`}>
            <Reveal>
              <div className="beat-card" onClick={() => setMetric(b.metric)}>
                <span>{b.kick}</span>
                <h3>{b.title}</h3>
                <p>{b.text}</p>
              </div>
            </Reveal>
          </div>
        ))}
      </div>
    </div>
  )
}
