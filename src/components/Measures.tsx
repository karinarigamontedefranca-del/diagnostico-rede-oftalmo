import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Step, describe, fmt } from '../lib/data'

const axisSec = (v: number) => (v >= 3600 ? `${+(v / 3600).toFixed(1)} h` : v >= 60 ? `${Math.round(v / 60)} min` : `${v} s`)

function Stat({ l, v }: { l: string; v: string }) {
  return <div><div style={{ color: 'var(--color-muted)', fontSize: 14 }}>{l}</div><div className="big num" style={{ fontSize: 34, marginTop: 4 }}>{v}</div></div>
}

export default function Measures({ steps, initial }: { steps: Step[]; initial?: string }) {
  const [sel, setSel] = useState<string>(initial && steps.some((s) => s.id === initial) ? initial : steps[0].id)
  useEffect(() => { if (initial && steps.some((s) => s.id === initial)) setSel(initial) }, [initial, steps])
  const step = steps.find((s) => s.id === sel)!
  const d = useMemo(() => describe(step), [step])
  const isOut = (sec: number) => sec > d.fence

  // histograma (faixas de largura igual entre o menor e o maior valor)
  const hist = useMemo(() => {
    const bins = Math.min(10, Math.max(4, Math.round(Math.sqrt(step.n))))
    const lo = step.min, hi = step.max, w = (hi - lo) / bins || 1
    const arr = Array.from({ length: bins }, (_, i) => ({ from: lo + i * w, to: lo + (i + 1) * w, n: 0 }))
    step.samples.forEach((s) => { arr[Math.min(bins - 1, Math.floor((s.seconds - lo) / w))].n++ })
    return arr.map((b) => ({ ...b, label: fmt(Math.round(b.from), { compact: true }).replace(' min','′') }))
  }, [step])

  const seq = step.samples.map((s, i) => ({ i: i + 1, ...s }))

  // tabela
  const [q, setQ] = useState(''); const [filter, setFilter] = useState('todas')
  const [sort, setSort] = useState<{ k: string; dir: 1 | -1 }>({ k: 'row', dir: 1 })
  useEffect(() => { setQ(''); setFilter('todas'); setSort({ k: 'row', dir: 1 }) }, [sel])
  const rows = useMemo(() => {
    let r = step.samples.map((s) => ({ ...s, out: isOut(s.seconds) }))
    if (q) r = r.filter((s) => `${s.row} ${s.obs ?? ''} ${s.note ?? ''} ${s.start ?? ''}`.toLowerCase().includes(q.toLowerCase()))
    if (filter === 'obs') r = r.filter((s) => s.note)
    if (filter === 'out') r = r.filter((s) => s.out)
    if (filter === 'flag') r = r.filter((s) => s.flag)
    const val = (s: any) => (sort.k === 'note' ? s.note || '' : s[sort.k] ?? -1)
    return [...r].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, q, filter, sort])
  const th = (k: string, label: string) => (
    <th aria-sort={sort.k === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : 1 }))}>{label} <span aria-hidden>{sort.k === k ? (sort.dir === 1 ? '↑' : '↓') : ''}</span></button>
    </th>
  )
  const hasTimes = step.samples.some((s) => s.start)

  return (
    <div id="medicoes">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }} role="group" aria-label="Etapas medidas">
        {steps.map((s) => (
          <button key={s.id} className="chip" aria-pressed={s.id === sel} onClick={() => setSel(s.id)}>{s.label} <span className="num" style={{ opacity: 0.6 }}>· {s.n}</span></button>
        ))}
      </div>

      <div className="figure">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 30 }}>{step.label}</h3>
          <span style={{ color: 'var(--color-muted)', fontSize: 14 }}>{step.source} · {step.kind}</span>
        </div>
        {step.link.note && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-muted)' }}>{step.link.note}</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 24, margin: '28px 0' }}>
          <Stat l="Tempo médio" v={fmt(step.mean)} />
          <Stat l="Mediana" v={fmt(step.median)} />
          <Stat l="Menor" v={fmt(step.min)} />
          <Stat l="Maior" v={fmt(step.max)} />
          <Stat l="Medições" v={String(step.n)} />
          <Stat l="Desvio padrão" v={fmt(step.stdev)} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 28 }}>
          <div>
            <h4 style={{ fontSize: 18, marginBottom: 4 }}>Medições individuais</h4>
            <p style={{ color: 'var(--color-muted)', fontSize: 14, margin: '0 0 8px' }}>Na ordem da planilha. Âmbar: bem acima do usual. Linha tracejada: média.</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={seq} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e3ebec" />
                  <XAxis dataKey="i" tick={{ fontSize: 12, fill: '#5a7279' }} tickLine={false} axisLine={{ stroke: '#9db3b8' }} interval="preserveStartEnd" />
                  <YAxis tickFormatter={axisSec} tick={{ fontSize: 12, fill: '#5a7279' }} tickLine={false} axisLine={false} width={52} />
                  <Tooltip cursor={{ fill: 'rgba(14,127,134,.08)' }} content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="tipbox" style={{ position: 'static' }}><b>{fmt(payload[0].payload.seconds)}</b><br />linha {payload[0].payload.row} da planilha{payload[0].payload.start ? <><br />{payload[0].payload.start}–{payload[0].payload.end}</> : null}{payload[0].payload.note ? <><br />{payload[0].payload.note}</> : null}</div>
                  ) : null} />
                  <ReferenceLine y={step.mean} stroke="#0c2a32" strokeDasharray="5 4" />
                  <Bar dataKey="seconds" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false}>
                    {seq.map((s) => <Cell key={s.row} fill={isOut(s.seconds) ? 'var(--color-amber)' : 'var(--color-iris)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div>
            <h4 style={{ fontSize: 18, marginBottom: 4 }}>Distribuição dos tempos</h4>
            <p style={{ color: 'var(--color-muted)', fontSize: 14, margin: '0 0 8px' }}>Quantas medições caem em cada faixa de duração.</p>
            <div style={{ height: 280 }}>
              <ResponsiveContainer>
                <BarChart data={hist} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e3ebec" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#5a7279' }} tickLine={false} axisLine={{ stroke: '#9db3b8' }} interval={0} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#5a7279' }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip cursor={{ fill: 'rgba(14,127,134,.08)' }} content={({ active, payload }: any) => active && payload?.length ? (
                    <div className="tipbox" style={{ position: 'static' }}><b>{payload[0].value} medições</b><br />de {fmt(payload[0].payload.from)} a {fmt(payload[0].payload.to)}</div>) : null} />
                  <Bar dataKey="n" fill="var(--color-iris)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="figure" style={{ marginTop: 24 }}>
        <h3>Tabela de medições</h3>
        <p className="cap">Cada linha indica onde o valor está na planilha original, para conferência.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <input className="search" type="search" placeholder="Buscar por linha ou observação" aria-label="Buscar" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="search" aria-label="Filtrar" value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="todas">Todas as medições</option>
            <option value="obs">Com observação</option>
            <option value="out">Acima do usual</option>
            <option value="flag">Recalculadas</option>
          </select>
          <span style={{ alignSelf: 'center', color: 'var(--color-muted)', fontSize: 14 }}>{rows.length} de {step.n}</span>
        </div>
        <div style={{ maxHeight: 460, overflow: 'auto', border: '1px solid var(--color-line)', borderRadius: 12 }}>
          <table className="t">
            <thead><tr>{th('row', 'Linha na planilha')}{th('obs', 'Nº paciente')}{hasTimes && th('start', 'Início')}{hasTimes && th('end', 'Fim')}{th('seconds', 'Duração')}{th('note', 'Observação')}</tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.row}>
                  <td className="num">{s.row}</td><td className="num">{s.obs ?? '—'}</td>
                  {hasTimes && <td className="num">{s.start ?? '—'}</td>}{hasTimes && <td className="num">{s.end ?? '—'}</td>}
                  <td className="num" style={{ fontWeight: 600 }}>{fmt(s.seconds)} {s.out && <span className="pill amber" style={{ marginLeft: 6 }}>acima do usual</span>}{s.flag && <span className="pill" style={{ marginLeft: 6 }}>{s.flag}</span>}</td>
                  <td style={{ color: 'var(--color-muted)' }}>{s.note ?? ''}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} style={{ color: 'var(--color-muted)' }}>Nenhuma medição com esse filtro. Limpe a busca ou escolha “Todas as medições”.</td></tr>}
            </tbody>
          </table>
        </div>
        {step.excluded.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 14, color: 'var(--color-muted)' }}>
            <b style={{ color: 'var(--color-text)' }}>Desconsiderados nesta etapa ({step.excluded.length}):</b>{' '}
            {step.excluded.map((e) => `linha ${e.row} (${e.raw}: ${e.reason})`).join('; ')}.
          </div>
        )}
      </div>
    </div>
  )
}
