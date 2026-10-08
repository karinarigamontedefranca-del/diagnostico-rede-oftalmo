import { useEffect, useState } from 'react'
import type { Process } from '../lib/data'
import type { Route } from '../lib/router'
import { Logo } from './Brand'
import { startJourney } from './Hero'

export default function Nav({ route, processes }: { route: Route; processes: Process[] }) {
  const [prog, setProg] = useState(0)
  useEffect(() => {
    const on = () => { const h = document.documentElement; setProg(h.scrollHeight - innerHeight > 0 ? scrollY / (h.scrollHeight - innerHeight) : 0) }
    on(); window.addEventListener('scroll', on, { passive: true }); window.addEventListener('resize', on)
    return () => { window.removeEventListener('scroll', on); window.removeEventListener('resize', on) }
  }, [route.name])
  const toSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (location.hash.startsWith('#/processo')) { location.hash = '#/'; setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60) }
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  const goJourney = () => {
    if (location.hash.startsWith('#/processo')) { location.hash = '#/'; setTimeout(startJourney, 350) } else startJourney()
  }
  return (
    <nav className="nav" aria-label="Principal">
      <div className="nav-prog" style={{ transform: `scaleX(${prog})` }} />
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 28, height: 60 }}>
        <a href="#/" onClick={(e) => { e.preventDefault(); location.hash = '#/'; window.scrollTo({ top: 0 }) }} style={{ display: 'flex', gap: 10, alignItems: 'center', border: 0, padding: 0 }} aria-label="Início">
          <Logo who="skema" className="h-9" /><span aria-hidden style={{ color: 'var(--color-muted)' }}>×</span><Logo who="oftalmo" className="h-9" />
        </a>
        <div className="hidden md:flex" style={{ gap: 22, marginLeft: 'auto', alignItems: 'center' }}>
          <a href="#dashboard" onClick={toSection('dashboard')}>Resultados</a>
          <a href="#cronograma" onClick={toSection('cronograma')}>Cronograma</a>
          <a href="#processos" onClick={toSection('processos')} className={route.name === 'process' ? 'on' : ''}>Processos</a>
          <button className="nav-go" onClick={goJourney}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.500v15a1 1 0 0 0 1.500.9l12-7.500a1 1 0 0 0 0-1.800l-12-7.500A1 1 0 0 0 7 4.500z" /></svg>
            Iniciar jornada
          </button>
        </div>
      </div>
      {route.name === 'process' && (
        <div style={{ borderTop: '1px solid var(--color-line)' }}>
          <div className="wrap" style={{ display: 'flex', gap: 22, height: 46, alignItems: 'center', overflowX: 'auto' }}>
            {processes.map((p) => (
              <a key={p.id} href={`#/processo/${p.id}`} aria-current={route.id === p.id ? 'page' : undefined} style={{ whiteSpace: 'nowrap' }}>{p.title}</a>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
