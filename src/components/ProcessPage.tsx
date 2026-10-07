import { useEffect } from 'react'
import { Dataset, JOURNEY, fmt } from '../lib/data'
import BpmnViewer from './BpmnViewer'
import Measures from './Measures'

export default function ProcessPage({ data, id, step }: { data: Dataset; id: string; step?: string }) {
  const { processes, m } = data
  const idx = processes.findIndex((p) => p.id === id)
  const p = processes[idx]
  useEffect(() => { window.scrollTo({ top: 0 }) }, [id])
  useEffect(() => { if (step) setTimeout(() => document.getElementById('medicoes')?.scrollIntoView({ behavior: 'smooth' }), 250) }, [step, id])
  if (!p) return <main className="wrap" style={{ paddingTop: 140 }}><h2>Processo não encontrado</h2><a className="btn" href="#/">Voltar à visão geral</a></main>
  const steps = m.steps.filter((s) => s.link.process === p.id)
  const journey = JOURNEY(steps)
  const prev = processes[idx - 1], next = processes[idx + 1]
  const tasks = p.nodes.filter((n) => n.kind === 'task')
  const all = journey.flatMap((s) => s.samples.map((x) => x.seconds))
  const kpis: [string, string][] = journey.length
    ? [[String(p.counts.tasks), 'tarefas no fluxograma'], [String(journey.length), 'etapas cronometradas'], [String(all.reduce((a) => a + 1, 0)), 'medições válidas'], [fmt(Math.min(...all)), 'menor tempo observado'], [fmt(Math.max(...all)), 'maior tempo observado']]
    : [[String(p.counts.tasks), 'tarefas no fluxograma'], [String(p.counts.lanes), 'raias (equipes)'], [String(p.counts.gateways), 'decisões'], ...(p.totalLabel ? ([[p.totalLabel.value, 'tempo total registrado no diagrama (mm:ss)']] as [string, string][]) : [])]

  return (
    <main style={{ paddingTop: 150 }}>
      <div className="wrap">
        <a className="btn" href="#/">← Visão geral</a>
        <h1 style={{ fontSize: 'clamp(44px, 7vw, 92px)', fontWeight: 700, letterSpacing: '-0.04em', margin: '28px 0 8px' }}>{p.title}</h1>
        <p style={{ color: 'var(--color-muted)', fontSize: 18, margin: 0 }}>{p.poolName}</p>
        <div className="ledger" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 28, padding: '28px 0 0', marginTop: 36 }}>
          {kpis.map(([v, l]) => (
            <div key={l}><div className="big num" style={{ fontSize: 'clamp(30px,3.4vw,44px)' }}>{v}</div><div style={{ color: 'var(--color-muted)', fontSize: 14, marginTop: 6 }}>{l}</div></div>
          ))}
        </div>

        <section style={{ marginTop: 80 }}>
          <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 700 }}>Fluxograma</h2>
          <p className="lead measure" style={{ marginBottom: 24 }}>
            {journey.length ? 'Etapas destacadas em verde têm medições associadas; clique em uma etapa ou raia para ver tempo médio, menor e maior tempo.' : 'Clique em uma etapa para ver a raia responsável e as observações do diagrama.'}
          </p>
          <BpmnViewer key={p.id} process={p} steps={steps} focusStep={step} />
          {p.totalLabel && (
            <p style={{ marginTop: 16, color: 'var(--color-muted)' }}>
              Evento final do diagrama: “{p.totalLabel.text}”. Este é o único tempo registrado no fluxograma; ele não vem da planilha de cronoanálise.
            </p>
          )}
        </section>

        <section style={{ marginTop: 88 }}>
          <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 700 }}>Medições do processo</h2>
          {steps.length ? (
            <>
              <p className="lead measure" style={{ marginBottom: 32 }}>Escolha uma etapa para ver seus tempos, a variação entre medições e a tabela com todos os valores.</p>
              <Measures steps={steps} initial={step} />
            </>
          ) : (
            <div className="figure" style={{ marginTop: 24 }}>
              <h3>Sem medições na planilha recebida</h3>
              <p className="cap" style={{ marginBottom: 0 }}>A planilha de cronoanálise contém apenas etapas do processo de Glaucoma. Quando houver medições para {p.title}, basta incluí-las na planilha em <code>source/</code> e rodar <code>npm run data</code>.</p>
            </div>
          )}
        </section>

        <section style={{ marginTop: 88 }}>
          <h2 style={{ fontSize: 'clamp(28px,3.4vw,42px)', fontWeight: 700 }}>Etapas do fluxograma</h2>
          <div style={{ marginTop: 28, borderTop: '1px solid var(--color-ink)' }}>
            {tasks.map((t) => {
              const ss = steps.filter((s) => s.link.nodes.includes(t.id))
              return (
                <div key={t.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,2fr) minmax(120px,1fr) minmax(120px,1fr)', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--color-line)' }}>
                  <div><b>{t.name}</b>{t.doc && <div style={{ color: 'var(--color-muted)', fontSize: 14 }}>{t.doc}</div>}</div>
                  <div style={{ color: 'var(--color-muted)' }}>{p.lanes.find((l) => l.id === t.lane)?.name}</div>
                  <div className="num">{ss.length ? ss.map((s) => `${s.label}: ${fmt(s.mean, { compact: true })}`).join(' · ') : <span style={{ color: 'var(--color-muted)' }}>—</span>}</div>
                </div>
              )
            })}
          </div>
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, margin: '96px 0 0', paddingBottom: 80, flexWrap: 'wrap' }}>
          {prev ? <a className="btn" href={`#/processo/${prev.id}`}>← {prev.title}</a> : <span />}
          {next ? <a className="btn" href={`#/processo/${next.id}`}>{next.title} →</a> : <span />}
        </div>
      </div>
    </main>
  )
}
