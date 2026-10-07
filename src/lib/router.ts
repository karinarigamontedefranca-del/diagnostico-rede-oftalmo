import { useEffect, useState } from 'react'
export type Route = { name: 'home' } | { name: 'process'; id: string; step?: string }

export function parse(hash: string): Route {
  const h = hash.replace(/^#\/?/, '')
  const [path, q] = h.split('?')
  const parts = path.split('/')
  if (parts[0] === 'processo' && parts[1]) {
    const step = new URLSearchParams(q || '').get('etapa') || undefined
    return { name: 'process', id: parts[1], step }
  }
  return { name: 'home' }
}
export function useRoute(): Route {
  const [r, setR] = useState<Route>(() => parse(location.hash))
  useEffect(() => {
    const on = () => setR(parse(location.hash))
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return r
}
export const goProcess = (id: string, step?: string) => { location.hash = `#/processo/${id}${step ? `?etapa=${step}` : ''}` }
