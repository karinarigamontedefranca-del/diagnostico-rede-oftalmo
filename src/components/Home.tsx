import { useMemo, useState } from 'react'
import { Logo } from './Brand'
import { Dataset, JOURNEY, describe, fmt } from '../lib/data'
import { goProcess as go } from '../lib/router'

function Section({ id, kicker, title, lead, children }: { id: string; kicker: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section">
      <div className="wrap">
        <p className="kicker">{kicker}</p>
        <h2 className="h2">{title}</h2>
        {lead && <p className="lead measure">{lead}</p>}
        <div style={{ marginTop: 44 }}>{children}</div>
      </div>
    </section>
  )
}


export default function Home({ data }: { data: Dataset }) {
  const { processes, m } = data
  const journey = JOURNEY(m.steps)
  const totalN = journey.reduce((a, s) => a + s.n, 0)
  const all = journey.flatMap((s) => s.samples.map((x) => ({ ...x, step: s })))
  const lo = all.reduce((a, b) => (b.seconds < a.seconds ? b : a))
  const hi = all.reduce((a, b) => (b.seconds > a.seconds ? b : a))
  const tasks = processes.reduce((a, p) => a + p.counts.tasks, 0)
  const byMean = [...journey].sort((a, b) => b.mean - a.mean)
  const byN = [...journey].sort((a, b) => b.n - a.n)
  const maxMean = byMean[0].mean
  const maxN = byN[0].n
  const glaucoma = processes.find((p) => p.id === 'glaucoma')!

  return (
    <main>
      {/* Contexto */}
      <section id="contexto" className="section" style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56 }}>
          <div>
            <p className="kicker">Contexto do projeto</p>
            <h2 className="h2">Do que acontece na clínica ao que se pode medir.</h2>
          </div>
          <div className="measure" style={{ color: 'var(--color-muted)', fontSize: 18 }}>
            <p style={{ marginTop: 0 }}>
              A SKEMA Consultoria Júnior mapeou {processes.length} processos da Rede Oftalmo — {processes.map((p) => p.title).join(', ').replace(/, ([^,]*)$/, ' e $1')} — e os desenhou em fluxogramas BPMN, com as responsabilidades de cada equipe separadas em raias.
            </p>
            <p>
              Para o processo de Glaucoma, as etapas também foram cronometradas por observação direta: {journey.length} etapas, {totalN} medições. Este site reúne fluxogramas e tempos no mesmo lugar, para que cada número possa ser conferido na etapa de onde veio.
            </p>
          </div>
        </div>
      </section>

      {/* Visão geral */}
      <Section id="visao-geral" kicker="Visão geral" title="O projeto em números">
        <div className="ledger">
          {[
            [String(processes.length), '', 'Processos mapeados', processes.map((p) => p.title).join(' · ')],
            [String(tasks), '', 'Tarefas desenhadas nos fluxogramas', `${processes.map((p) => `${p.title}: ${p.counts.tasks}`).join(' · ')}`],
            [String(journey.length), '', 'Etapas cronometradas', 'Todas no processo de Glaucoma'],
            [String(totalN), '', 'Medições válidas', 'Cada etapa tem sua própria contagem de pacientes observados'],
            [fmt(lo.seconds), '', 'Menor tempo observado', `${lo.step.label} · linha ${lo.row} da planilha`],
            [fmt(hi.seconds), '', 'Maior tempo observado', `${hi.step.label} · linha ${hi.row} da planilha — acima do padrão das demais, vale conferir`],
          ].map(([v, u, l, d]) => (
            <div className="row" key={l}>
              <div className="big num">{v}<small>{u}</small></div>
              <div><div style={{ fontWeight: 600, fontSize: 19 }}>{l}</div><div style={{ color: 'var(--color-muted)' }}>{d}</div></div>
            </div>
          ))}
        </div>
      </Section>

      {/* Dashboard */}
      <Section id="dashboard" kicker="Dashboard" title="Onde o tempo se concentra" lead="Comparação das etapas cronometradas no processo de Glaucoma. Clique em uma etapa para abrir suas medições.">
        <div style={{ display: 'grid', gap: 24 }}>
          <div className="figure">
            <h3>Quais etapas levam mais tempo?</h3>
            <p className="cap">Tempo médio por etapa. A marca escura indica a mediana — quando ela fica bem abaixo da barra, poucos casos longos puxam a média.</p>
            {byMean.map((s) => (
              <button key={s.id} className="hbar" onClick={() => go('glaucoma', s.id)} title={`${s.label}: média ${fmt(s.mean)} · mediana ${fmt(s.median)} · menor ${fmt(s.min)} · maior ${fmt(s.max)} · ${s.n} medições`}>
                <span className="lab">{s.label}</span>
                <span className="track"><span className="fill" style={{ width: `${(s.mean / maxMean) * 100}%` }} /><span className="tick" style={{ left: `calc(${(s.median / maxMean) * 100}% - 1px)` }} /></span>
                <span className="val num">{fmt(s.mean, { compact: true })}</span>
              </button>
            ))}
          </div>

          <RangePlot steps={journey} />

          <div className="figure">
            <h3>Quantas medições sustentam cada etapa?</h3>
            <p className="cap">Quanto menor a amostra, mais cautela ao tirar conclusões da média.</p>
            {byN.map((s) => (
              <button key={s.id} className="hbar" onClick={() => go('glaucoma', s.id)}>
                <span className="lab">{s.label}</span>
                <span className="track"><span className="fill" style={{ width: `${(s.n / maxN) * 100}%`, background: '#8b90b5' }} /></span>
                <span className="val num">{s.n}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <Extreme tone="amber" title="Maior tempo individual" step={hi.step.label} value={fmt(hi.seconds)} note={`linha ${hi.row} da planilha${hi.start ? ` · ${hi.start}–${hi.end}` : ''}`} />
            <Extreme tone="iris" title="Menor tempo individual" step={lo.step.label} value={fmt(lo.seconds)} note={`linha ${lo.row} da planilha`} />
            <Extreme tone="amber" title="Maior tempo médio" step={byMean[0].label} value={fmt(byMean[0].mean)} note={`${byMean[0].n} medições`} />
          </div>
        </div>
      </Section>

      {/* Processos */}
      <Section id="processos" kicker="Processos mapeados" title="Três fluxos, um mesmo olhar" lead="Abra um processo para ver o fluxograma interativo e as medições associadas.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24 }}>
          {processes.map((p) => {
            const st = m.steps.filter((s) => s.link.process === p.id && s.id !== 'pos-consulta-ociosidade')
            const n = st.reduce((a, s) => a + s.n, 0)
            return (
              <a key={p.id} className="pcard" href={`#/processo/${p.id}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <h3 style={{ fontSize: 30, fontWeight: 700 }}>{p.title}</h3>
                  {st.length ? <span className="pill">{n} medições</span> : <span className="pill gray">sem medições</span>}
                </div>
                <p style={{ color: 'var(--color-muted)', margin: '8px 0 24px' }}>{p.short}</p>
                <dl style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, margin: 0 }}>
                  <div><dd className="big num" style={{ fontSize: 34, margin: 0 }}>{p.counts.tasks}</dd><dt style={{ fontSize: 13, color: 'var(--color-muted)' }}>tarefas</dt></div>
                  <div><dd className="big num" style={{ fontSize: 34, margin: 0 }}>{p.counts.lanes}</dd><dt style={{ fontSize: 13, color: 'var(--color-muted)' }}>raias</dt></div>
                  <div><dd className="big num" style={{ fontSize: 34, margin: 0 }}>{st.length ? st.length : p.totalLabel ? p.totalLabel.value : '—'}</dd><dt style={{ fontSize: 13, color: 'var(--color-muted)' }}>{st.length ? 'etapas medidas' : p.totalLabel ? 'tempo total no diagrama' : ''}</dt></div>
                </dl>
              </a>
            )
          })}
        </div>
      </Section>

      {/* Notas */}
      <Section id="notas" kicker="Notas sobre os dados" title="O que foi feito com a planilha" lead="Transparência sobre como cada número foi obtido e onde as associações não são certas.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {m.quality.map((q) => (
            <div key={q.id} className="figure" style={{ padding: 24 }}>
              <span className={`pill ${q.level === 'atenção' ? 'amber' : q.level === 'info' ? 'gray' : ''}`}>{q.level}</span>
              <h3 style={{ fontSize: 20, margin: '12px 0 8px' }}>{q.title}</h3>
              <p style={{ margin: 0, color: 'var(--color-muted)', fontSize: 15 }}>{q.text}</p>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--color-muted)', marginTop: 28, fontSize: 14 }}>Fonte: {m.source}. Fluxograma de Glaucoma: {glaucoma.sourceFile}.</p>
      </Section>

      <footer style={{ background: 'var(--color-deep)', color: '#b9bddb', padding: '48px 0', marginTop: 80 }}>
        <div className="wrap" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24 }}>
          <Logo who="skema" tone="dark" className="h-12" />
          <span>Mapeamento de Processos · Rede Oftalmo</span>
        </div>
      </footer>
    </main>
  )
}

function Extreme({ title, step, value, note, tone }: { title: string; step: string; value: string; note: string; tone: 'amber' | 'iris' }) {
  return (
    <div className="figure" style={{ borderLeft: `4px solid var(--color-${tone})` }}>
      <div style={{ color: 'var(--color-muted)', fontSize: 15 }}>{title}</div>
      <div className="big num" style={{ margin: '8px 0' }}>{value}</div>
      <div style={{ fontWeight: 600 }}>{step}</div>
      <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>{note}</div>
    </div>
  )
}

/** Faixa de variação por etapa: mín–máx, quartis e mediana (escala logarítmica). */
function RangePlot({ steps }: { steps: Dataset['m']['steps'] }) {
  const rows = useMemo(() => steps.map((s) => ({ s, d: describe(s) })).sort((a, b) => b.s.median - a.s.median), [steps])
  const lo = Math.min(...steps.map((s) => Math.max(s.min, 1))), hi = Math.max(...steps.map((s) => s.max))
  const L = Math.log(lo) - 0.08, H = Math.log(hi) + 0.08
  const pos = (v: number) => `${((Math.log(Math.max(v, 1)) - L) / (H - L)) * 100}%`
  const ticks = [10, 30, 60, 120, 300, 600, 1800, 3600].filter((t) => t >= lo * 0.9 && t <= hi * 1.1)
  const [hov, setHov] = useState<string | null>(null)
  return (
    <div className="figure">
      <h3>Como variam as medições dentro de cada etapa?</h3>
      <p className="cap">Linha fina: do menor ao maior tempo. Barra: metade central das medições (25% a 75%). Marca: mediana. Pontos âmbar: tempos bem acima do usual. Escala logarítmica, para que etapas rápidas e longas caibam juntas.</p>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 560 }}>
          {rows.map(({ s, d }) => (
            <button key={s.id} className="hbar" style={{ gridTemplateColumns: 'minmax(120px,190px) 1fr 120px' }} onClick={() => go('glaucoma', s.id)} onMouseEnter={() => setHov(s.id)} onMouseLeave={() => setHov(null)}>
              <span className="lab">{s.label}</span>
              <span style={{ position: 'relative', height: 22 }}>
                {ticks.map((t) => <span key={t} style={{ position: 'absolute', left: pos(t), top: 0, bottom: 0, width: 1, background: '#e4e3ea' }} />)}
                <span style={{ position: 'absolute', left: pos(s.min), width: `calc(${pos(s.max)} - ${pos(s.min)})`, top: 10, height: 2, background: '#8b90b5' }} />
                <span style={{ position: 'absolute', left: pos(d.q1), width: `calc(${pos(d.q3)} - ${pos(d.q1)})`, top: 4, height: 14, background: 'var(--color-iris)', borderRadius: 4, opacity: hov === s.id ? 1 : 0.88 }} />
                <span style={{ position: 'absolute', left: `calc(${pos(s.median)} - 1.5px)`, top: 1, height: 20, width: 3, background: 'var(--color-ink)', borderRadius: 2 }} />
                {d.outliers.map((o, i) => <span key={i} style={{ position: 'absolute', left: `calc(${pos(o.seconds)} - 4px)`, top: 7, width: 8, height: 8, borderRadius: 4, background: 'var(--color-amber)', border: '1.5px solid #fff' }} />)}
              </span>
              <span className="val num" style={{ fontSize: 13, fontWeight: 500 }}>{fmt(s.min, { compact: true })} – {fmt(s.max, { compact: true })}</span>
            </button>
          ))}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,190px) 1fr 120px', gap: 14 }}>
            <span />
            <span style={{ position: 'relative', height: 20 }}>
              {ticks.map((t) => <span key={t} className="num" style={{ position: 'absolute', left: pos(t), transform: 'translateX(-50%)', fontSize: 12, color: 'var(--color-muted)' }}>{fmt(t, { compact: true }).replace(' min', ' min')}</span>)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
