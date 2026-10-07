import { Logo } from './Brand'

export default function Intro({ onStart }: { onStart: () => void }) {
  return (
    <header className="intro" id="topo">
      <div className="intro-inner">
        <div className="brand-row" aria-label="Rede Oftalmo e SKEMA Consultoria Júnior">
          <Logo who="skema" tone="dark" className="logo-l" />
          <div className="link"><i /><b className="sq" /><b className="di" /></div>
          <div className="mark" aria-hidden="true">×</div>
          <div className="link rev"><i /><b className="sq" /><b className="di" /></div>
          <div className="plate r"><Logo who="oftalmo" /></div>
        </div>
        <div>
          <h1 className="title">Mapeamento de Processos</h1>
          <p className="subtitle">Rede Oftalmo × SKEMA Consultoria Júnior</p>
          <p className="tagline">Processos transformados em informação. Informação transformada em decisão.</p>
        </div>
        <button className="cta" onClick={onStart}>
          Explorar análise
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
        </button>
      </div>
    </header>
  )
}
