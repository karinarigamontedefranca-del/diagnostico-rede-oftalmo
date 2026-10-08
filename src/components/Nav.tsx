import { useEffect, useState } from 'react'
import type { Process } from '../lib/data'
import type { Route } from '../lib/router'
import { Logo } from './Brand'

export default function Nav({ route, processes }: { route: Route; processes: Process[] }) {
  const [show, setShow] = useState(route.name !== 'home')
  useEffect(() => {
    if (route.name !== 'home') { setShow(true); return }
    const on = () => setShow(window.scrollY > window.innerHeight * 0.7)
    on(); window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [route.name])
  const toSection = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (location.hash.startsWith('#/processo')) { location.hash = '#/'; setTimeout(() => document.getElementById(id)?.scrollIntoView(), 60) }
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }
  return (
    <nav className={`nav ${show ? '' : 'hide'}`} aria-label="Principal">
      <div className="wrap" style={{ display: 'flex', alignItems: 'center', gap: 28, height: 60 }}>
        <a href="#/" onClick={(e) => { e.preventDefault(); location.hash = '#/'; window.scrollTo({ top: 0 }) }} style={{ display: 'flex', gap: 10, alignItems: 'center', border: 0, padding: 0 }} aria-label="Início">
          <Logo who="skema" className="h-9" /><span aria-hidden style={{ color: 'var(--color-muted)' }}>×</span><Logo who="oftalmo" className="h-9" />
        </a>
        <div className="hidden md:flex" style={{ gap: 22, marginLeft: 'auto', alignItems: 'center' }}>
          <a href="#jornada" onClick={toSection('jornada')}>Jornada</a>
          <a href="#visao-geral" onClick={toSection('visao-geral')}>Visão geral</a>
          <a href="#dashboard" onClick={toSection('dashboard')}>Dashboard</a>
          <a href="#cronograma" onClick={toSection('cronograma')}>Cronograma</a>
          <a href="#processos" onClick={toSection('processos')} className={route.name === 'process' ? 'on' : ''}>Processos</a>
          <a href="#notas" onClick={toSection('notas')}>Notas sobre os dados</a>
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
