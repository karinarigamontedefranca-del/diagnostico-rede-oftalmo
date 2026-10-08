import { Logo } from './Brand'
import { Dataset, JOURNEY, fmt } from '../lib/data'
import { goProcess } from '../lib/router'
import { CountUp, Reveal } from './Reveal'

export const startJourney = () => window.dispatchEvent(new Event('iniciar-jornada'))

/** Abertura: já começa pelos resultados. */
export default function Hero({ data }: { data: Dataset }) {
  const { processes, m } = data
  const journey = JOURNEY(m.steps)
  const totalN = journey.reduce((a, s) => a + s.n, 0)
  const tasks = processes.reduce((a, p) => a + p.counts.tasks, 0)
  const decisions = processes.reduce((a, p) => a + p.counts.gateways, 0)
  const byMean = [...journey].sort((a, b) => b.mean - a.mean)
  const top = byMean.slice(0, 6)
  const max = top[0].mean
  const kpis: { v: number; f?: (v: number) => string; l: string; d: string }[] = [
    { v: processes.length, l: 'processos mapeados', d: processes.map((p) => p.title).join(' · ') },
    { v: tasks, l: 'etapas desenhadas', d: `${decisions} decisões · ${processes.reduce((a, p) => a + p.counts.lanes, 0)} raias de equipes` },
    { v: totalN, l: 'medições de tempo', d: `${journey.length} etapas do Glaucoma cronometradas` },
    { v: byMean[0].mean, f: (v) => fmt(v), l: 'etapa mais longa (média)', d: byMean[0].label },
  ]
  return (
    <header className="hero" id="topo">
      <div className="hero-grid" aria-hidden="true" />
      <div className="wrap hero-in">
        <div className="hero-brand">
          <Logo who="skema" tone="dark" className="hb-l" />
          <span aria-hidden="true">×</span>
          <span className="hb-plate"><Logo who="oftalmo" /></span>
        </div>

        <div className="hero-main">
          <div>
            <p className="kicker hero-kick">Resultados do mapeamento de processos</p>
            <h1 className="hero-h1">O que a clínica mostrou quando foi medida.</h1>
            <p className="hero-lead">{processes.length} fluxos desenhados, {totalN} tempos cronometrados. Role a página para ver cada resultado aparecer — ou entre direto na jornada de um paciente.</p>
            <div className="hero-cta">
              <button className="cta" onClick={startJourney}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.500a1 1 0 0 0 0-1.800l-12-7.500A1 1 0 0 0 7 4.500z" /></svg>
                Iniciar jornada
              </button>
              <a className="cta-ghost" href="#dashboard" onClick={(e) => { e.preventDefault(); document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' }) }}>Ver resultados ↓</a>
            </div>
          </div>

          <div className="hero-spark" role="img" aria-label={`Etapas mais longas: ${top.map((s) => `${s.label} ${fmt(s.mean)}`).join(', ')}`}>
            <p>Tempo médio das etapas mais longas</p>
            {top.map((s, i) => (
              <button key={s.id} className="hs-row" style={{ ['--i' as string]: i }} onClick={() => goProcess('glaucoma', s.id)} title={`${s.label}: média ${fmt(s.mean)} · ${s.n} medições`}>
                <span>{s.label}</span>
                <i><u style={{ ['--w' as string]: `${(s.mean / max) * 100}%` }} /></i>
                <b className="num">{fmt(s.mean, { compact: true })}</b>
              </button>
            ))}
          </div>
        </div>

        <div className="hero-kpis">
          {kpis.map((k, i) => (
            <Reveal key={k.l} delay={300 + i * 110} className="hk">
              <b className="big"><CountUp value={k.v} format={k.f} /></b>
              <strong>{k.l}</strong>
              <span>{k.d}</span>
            </Reveal>
          ))}
        </div>
      </div>
      <a className="hero-cue" href="#dashboard" onClick={(e) => { e.preventDefault(); document.getElementById('dashboard')?.scrollIntoView({ behavior: 'smooth' }) }} aria-label="Rolar para os resultados"><i /></a>
    </header>
  )
}
