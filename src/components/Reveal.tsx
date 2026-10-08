import { useEffect, useRef, useState } from 'react'

export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** true assim que o elemento entra na tela (uma vez só) */
export function useInView<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current; if (!el || seen) return
    if (typeof IntersectionObserver === 'undefined' || reduceMotion()) { setSeen(true); return }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect() } }, { threshold, rootMargin: '0px 0px -8% 0px' })
    io.observe(el); return () => io.disconnect()
  }, [seen, threshold])
  return [ref, seen] as const
}

/** conteúdo que sobe e aparece quando a pessoa chega até ele na rolagem */
export function Reveal({ children, delay = 0, className = '', style }: { children: React.ReactNode; delay?: number; className?: string; style?: React.CSSProperties }) {
  const [ref, seen] = useInView<HTMLDivElement>()
  return <div ref={ref} className={`rv ${seen ? 'in' : ''} ${className}`} style={{ ['--d' as string]: `${delay}ms`, ...style }}>{children}</div>
}

/** número que “conta” até o valor quando entra na tela */
export function CountUp({ value, format = (v: number) => String(Math.round(v)), duration = 1500 }: { value: number; format?: (v: number) => string; duration?: number }) {
  const [ref, seen] = useInView<HTMLSpanElement>(0.4)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!seen) return
    if (reduceMotion()) { setV(value); return }
    let raf = 0; const t0 = performance.now()
    const tick = (t: number) => { const k = Math.min(1, (t - t0) / duration); setV(value * (1 - Math.pow(1 - k, 4))); if (k < 1) raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [seen, value, duration])
  return <span ref={ref} className="num">{format(seen ? v : 0)}</span>
}
