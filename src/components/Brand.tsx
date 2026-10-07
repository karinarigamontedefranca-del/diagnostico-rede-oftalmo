import { useState } from 'react'

const FILES = {
  skema: ['skema.svg', 'skema.png', 'skema.webp', 'skema.jpg'],
  oftalmo: ['rede-oftalmo.svg', 'rede-oftalmo.png', 'rede-oftalmo.webp', 'rede-oftalmo.jpg'],
}
// Texto exibido apenas enquanto os arquivos de logo não estiverem em /public/logos
export function Logo({ who, className = '' }: { who: 'skema' | 'oftalmo'; className?: string }) {
  const [i, setI] = useState(0)
  const list = FILES[who]
  if (i >= list.length)
    return who === 'skema' ? (
      <span className={`wordmark ${className}`}>SKEMA<small>Consultoria Júnior</small></span>
    ) : (
      <span className={`wordmark ${className}`}>Rede Oftalmo</span>
    )
  return <img className={className} src={`${import.meta.env.BASE_URL}logos/${list[i]}`} alt={who === 'skema' ? 'SKEMA Consultoria Júnior' : 'Rede Oftalmo'} onError={() => setI(i + 1)} />
}

export function Aperture() {
  const ticks = Array.from({ length: 24 }, (_, k) => k)
  return (
    <svg className="aperture" viewBox="0 0 200 200" aria-hidden="true">
      <g className="spin" fill="none" stroke="#45c1b8">
        <circle cx="100" cy="100" r="92" strokeWidth="1" strokeDasharray="2 7" opacity=".7" />
        {ticks.map((k) => (
          <line key={k} x1="100" y1="6" x2="100" y2={k % 6 === 0 ? 20 : 13} transform={`rotate(${k * 15} 100 100)`} strokeWidth={k % 6 === 0 ? 2 : 1} opacity=".8" />
        ))}
      </g>
      <circle cx="100" cy="100" r="64" fill="none" stroke="#45c1b8" strokeWidth="2" />
      <circle cx="100" cy="100" r="42" fill="#0c2a32" stroke="#bfe6e3" strokeWidth="1.5" />
      <circle cx="100" cy="100" r="18" fill="#f2b45e" />
      <circle cx="108" cy="92" r="5" fill="#fff" opacity=".85" />
    </svg>
  )
}
