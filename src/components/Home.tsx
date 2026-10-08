import { useMemo, useState } from 'react'
import { Logo } from './Brand'
import { Dataset, JOURNEY, WD, describe, fmt, planDate, weekday } from '../lib/data'
import { goProcess as go } from '../lib/router'
import Journey from './Journey'
import Explorer from './Explorer'
import { Reveal } from './Reveal'

function Section({ id, kicker, title, lead, children }: { id: string; kicker: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="section">
      <div className="wrap">
        <Reveal>
          <p className="kicker">{kicker}</p>
          <h2 className="h2">{title}</h2>
          {lead && <p className="lead measure">{lead}</p>}
        </Reveal>
        <div style={{ marginTop: 44 }}>{children}</div>
      </div>
    </section>
  )
}


export default function Home({ data }: { data: Dataset }) {
  const { processes, m } = data
  const plan = m.plan
  const journey = JOURNEY(m.steps)
  const totalN = journey.reduce((a, s) => a + s.n, 0)
  const all = journey.flatMap((s) => s.samples.map((x) => ({ ...x, step: s })))
  const lo = all.filter((x) => x.seconds > 0).reduce((a, b) => (b.seconds < a.seconds ? b : a))
  const byMean = [...journey].sort((a, b) => b.mean - a.mean)
  // cronograma de coleta: meta de 100 por etapa, 40 medições por dia de coleta, todas as etapas
  const coll = useMemo(() => {
    const target = plan.target, perVisit = 40
    const rows = journey.map((s) => ({ id: s.id, label: s.label, n: s.n, missing: Math.max(0, target - s.n) })).filter((r) => r.missing > 0).sort((a, b) => b.missing - a.missing)
    const total = rows.reduce((a, r) => a + r.missing, 0)
    const visits = Math.ceil(total / perVisit)
    const dates: string[] = []
    const d = new Date(plan.schedule[0].date + 'T12:00')
    while (dates.length < visits) {
      if (plan.weekdays.includes((d.getDay() + 6) % 7)) dates.push(d.toISOString().slice(0, 10))
      d.setDate(d.getDate() + 1)
    }
    const scen = [25, 34, 35, 40].map((per) => { const v = Math.ceil(total / per); return { per, visits: v, weeks: v / plan.perWeek } })
    return { target, perVisit, rows, total, visits, last: total - perVisit * (visits - 1), weeks: visits / plan.perWeek, dates, end: dates[dates.length - 1], scen }
  }, [journey, plan])

  return (
    <main>
      {/* Dashboard */}
      <Section id="dashboard" kicker="Resultados" title="Onde o tempo se concentra" lead="Comparação das etapas cronometradas no processo de Glaucoma. Clique em uma etapa para abrir suas medições.">
        <div style={{ display: 'grid', gap: 24 }}>
          <Explorer steps={journey} />

          <Reveal><RangePlot steps={journey} /></Reveal>

          <Reveal style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <Extreme tone="iris" title="Menor tempo individual" step={lo.step.label} value={fmt(lo.seconds)} note={`linha ${lo.row} da planilha`} />
            <Extreme tone="amber" title="Maior tempo médio" step={byMean[0].label} value={fmt(byMean[0].mean)} note={`${byMean[0].n} medições`} />
          </Reveal>
        </div>
      </Section>

      {/* Cronograma de coleta */}
      <Section id="cronograma" kicker="Próximas coletas" title={`${coll.visits} visitas para fechar as ${coll.target} medições de cada etapa`}
        lead={`Com ${coll.perVisit} medições por dia de coleta, faltam ${coll.total} medições no total: ${coll.total} ÷ ${coll.perVisit} dá ${(coll.total / coll.perVisit).toFixed(1).replace('.', ',')}, então a ${coll.visits}ª visita é a última e fica com ${coll.last} medições. Indo ${plan.perWeek} vezes por semana, são ${coll.weeks} semanas.`}>
        <Reveal>
        <div className="plan-kpis">
          <div><b className="num">{coll.visits}</b><span>visitas necessárias</span></div>
          <div><b className="num">{coll.total}</b><span>medições que faltam ({coll.perVisit} por visita)</span></div>
          <div><b className="num">{coll.weeks}</b><span>semanas, com {plan.perWeek} visitas por semana</span></div>
          <div><b className="num">{planDate(coll.end)}</b><span>{weekday(coll.end)} · última visita, em {coll.end.slice(0, 4)}</span></div>
        </div>
        <div className="plan-grid">
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 6 }}>Onde cada etapa está hoje</h3>
            <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Barra escura: medições já feitas. Barra clara: o que falta para {coll.target}.</p>
            {coll.rows.map((s) => (
              <div key={s.id} className="plan-row">
                <span>{s.label}</span>
                <span className="trk" title={`${s.n} feitas · faltam ${s.missing}`}><i style={{ width: `${Math.min(100, (s.n / coll.target) * 100)}%` }} /><u style={{ left: `${Math.min(100, (s.n / coll.target) * 100)}%`, right: 0 }} /></span>
                <span className="v num">{s.n} / {coll.target}</span>
              </div>
            ))}
          </div>
          <div>
            <h3 style={{ fontSize: 20, marginBottom: 6 }}>E se mudar o ritmo?</h3>
            <p style={{ color: 'var(--color-muted)', marginTop: 0 }}>Quantas visitas e semanas para as {coll.total} medições, conforme quantas se coleta por dia.</p>
            <table className="t scen">
              <thead><tr><th>Medições por visita</th><th>Visitas</th><th>Semanas</th></tr></thead>
              <tbody>
                {coll.scen.map((r) => (
                  <tr key={r.per} className={r.per === coll.perVisit ? 'sel' : ''}>
                    <td className="num">{r.per}{r.per === 34 ? ' (ritmo atual)' : r.per === coll.perVisit ? ' (proposta)' : ''}</td>
                    <td className="num">{r.visits}</td><td className="num">{String(r.weeks).replace('.', ',')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 14 }}>Passar de 34 para {coll.perVisit} por visita adianta o fim em cerca de {String(Math.round((coll.scen.find((r) => r.per === 34)!.weeks - coll.weeks) * 10) / 10).replace('.', ',')} semanas.</p>
            <h3 style={{ fontSize: 20, margin: '28px 0 10px' }}>Calendário das {coll.visits} visitas</h3>
            <p style={{ color: 'var(--color-muted)', marginTop: 0, fontSize: 14 }}>Nos mesmos dias da semana das últimas coletas ({plan.weekdays.map((w) => WD[w]).join(' e ')}), a partir de {planDate(coll.dates[0])}.</p>
            <div className="cal">
              {coll.dates.map((d, i) => <span key={d} className={i === coll.dates.length - 1 ? 'last' : ''} title={`Visita ${i + 1} · ${weekday(d)}`}><small>{i + 1}</small>{planDate(d)}</span>)}
            </div>
          </div>
        </div>
        </Reveal>
      </Section>

      {/* Contexto */}
      <section id="contexto" className="section">
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 56 }}>
          <Reveal>
            <p className="kicker">Sobre o projeto</p>
            <h2 className="h2">Do que acontece na clínica ao que se pode medir.</h2>
          </Reveal>
          <Reveal delay={120} className="measure">
            <div style={{ color: 'var(--color-muted)', fontSize: 18 }}>
              <p style={{ marginTop: 0 }}>
                A SKEMA Consultoria Júnior mapeou {processes.length} processos da Rede Oftalmo — {processes.map((p) => p.title).join(', ').replace(/, ([^,]*)$/, ' e $1')} — e os desenhou em fluxogramas BPMN, com as responsabilidades de cada equipe separadas em raias.
              </p>
              <p>
                Para o processo de Glaucoma, as etapas também foram cronometradas por observação direta: {journey.length} etapas, {totalN} medições. Cada número pode ser conferido na etapa de onde veio.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

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
                  <div><dd className="big num" style={{ fontSize: 34, margin: 0 }}>{st.length ? st.length : p.totalLabel ? p.totalLabel.value : '—'}</dd><dt style={{ fontSize: 13, color: 'var(--color-muted)' }}>{st.length ? 'etapas medidas' : p.totalLabel ? 'tempo no diagrama' : ''}</dt></div>
                </dl>
              </a>
            )
          })}
        </div>
      </Section>

      <Journey data={data} />

      <footer style={{ background: 'var(--color-deep)', color: '#b9bddb', padding: '48px 0' }}>
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
