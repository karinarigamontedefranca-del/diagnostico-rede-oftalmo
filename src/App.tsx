import { useEffect, useState } from 'react'
import { Dataset, loadDataset } from './lib/data'
import { useRoute } from './lib/router'
import Hero from './components/Hero'
import Nav from './components/Nav'
import Home from './components/Home'
import ProcessPage from './components/ProcessPage'

export default function App() {
  const [data, setData] = useState<Dataset | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const route = useRoute()
  useEffect(() => { loadDataset().then(setData).catch((e) => setErr(String(e))) }, [])
  if (err) return <p style={{ padding: 40 }}>Não foi possível carregar os dados: {err}. Rode <code>npm run data</code> e recarregue.</p>
  if (!data) return <div style={{ minHeight: '100svh', background: 'var(--color-ink)' }} />
  return (
    <>
      <Nav route={route} processes={data.processes} />
      {route.name === 'home' ? (
        <>
          <Hero data={data} />
          <Home data={data} />
        </>
      ) : (
        <ProcessPage data={data} id={route.id} step={route.step} />
      )}
    </>
  )
}
