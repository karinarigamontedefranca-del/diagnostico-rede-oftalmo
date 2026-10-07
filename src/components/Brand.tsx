import { useState } from 'react'

const BASE = import.meta.env.BASE_URL + 'logos/'
/** tone = fundo onde a logo será colocada: 'dark' usa a logo branca da SKEMA, 'light' a logo azul. */
export function Logo({ who, tone = 'light', className = '' }: { who: 'skema' | 'oftalmo'; tone?: 'dark' | 'light'; className?: string }) {
  const [failed, setFailed] = useState(false)
  const file = who === 'oftalmo' ? 'rede-oftalmo.png' : tone === 'dark' ? 'skema-branca.png' : 'skema.png'
  if (failed)
    return <span className={`wordmark ${className}`} style={tone === 'dark' && who === 'skema' ? { color: '#fff' } : undefined}>{who === 'skema' ? 'SKEMA Consultoria Júnior' : 'Rede Oftalmo'}</span>
  return <img className={className} src={BASE + file} alt={who === 'skema' ? 'SKEMA Consultoria Júnior' : 'Rede Oftalmo'} onError={() => setFailed(true)} />
}
