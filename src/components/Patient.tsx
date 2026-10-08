/**
 * Personagem da jornada: um paciente desenhado em vetor (SVG), de perfil, com articulações
 * independentes (quadril, joelho, ombro, cotovelo) para um ciclo de caminhada de verdade.
 * Poses controladas por classe no elemento pai: .walking · .thinking · .cheer
 * Visuais (look) trocam só as variáveis de cor — ver `.pt[data-look]` em index.css.
 */
export type Look = 'a' | 'b' | 'c'
export const LOOKS: { id: Look; name: string }[] = [
  { id: 'a', name: 'Marina' },
  { id: 'b', name: 'Antônio' },
  { id: 'c', name: 'Helena' },
]

export default function Patient({ look = 'a' }: { look?: Look }) {
  return (
    <svg className="pt" data-look={look} viewBox="0 0 140 240" aria-hidden="true">
      <ellipse className="pt-shadow" cx="72" cy="232" rx="36" ry="5" />

      {/* braço de trás */}
      <g className="arm arm-b">
        <path className="sleeve-s" d="M66 84h12v30a6 6 0 0 1-12 0z" />
        <g className="fore fore-b">
          <path className="sleeve-s" d="M66.5 110h11v22a5.5 5.5 0 0 1-11 0z" />
          <circle className="skin-s" cx="72" cy="138" r="5.2" />
        </g>
      </g>

      {/* perna de trás */}
      <g className="leg leg-b">
        <path className="pants-s" d="M62 128h17v46a8.5 8.5 0 0 1-17 0z" />
        <g className="shin shin-b">
          <path className="pants-s" d="M63 168h15v48a7.5 7.5 0 0 1-15 0z" />
          <path className="shoe-s" d="M61 214h17c8 0 14 3 17 8 1 2 0 4-2 4H62a3 3 0 0 1-3-3v-6a3 3 0 0 1 2-3z" />
          <path className="sole" d="M59 224h37v2.6a2 2 0 0 1-2 2H61a2 2 0 0 1-2-2z" />
        </g>
      </g>

      {/* tronco */}
      <g className="torso">
        <path className="shirt" d="M64 66h16l2 14H62z" />
        <path className="jacket" d="M58 76c0-7 5-10 12-10h6c8 0 13 4 13 11l3 46c.3 6-3 11-9 11H64c-6 0-10-5-9.700-11z" />
        <path className="jacket-s" d="M58 76c-2 14-4 30-3.700 47 .3 6 3 11 9 11h5c-5-14-6-37-4-58z" />
        <path className="lapel" d="M74 66l-3 30M74 66l8 18-5 5" />
        <path className="pocket" d="M62 112h9" />
        <rect className="belt" x="55" y="124" width="33" height="3.600" rx="1.800" />
      </g>

      {/* perna da frente */}
      <g className="leg leg-f">
        <path className="pants" d="M62 128h17v46a8.5 8.5 0 0 1-17 0z" />
        <g className="shin shin-f">
          <path className="pants" d="M63 168h15v48a7.5 7.5 0 0 1-15 0z" />
          <path className="shoe" d="M61 214h17c8 0 14 3 17 8 1 2 0 4-2 4H62a3 3 0 0 1-3-3v-6a3 3 0 0 1 2-3z" />
          <path className="sole" d="M59 224h37v2.6a2 2 0 0 1-2 2H61a2 2 0 0 1-2-2z" />
        </g>
      </g>

      {/* cabeça */}
      <g className="head-g">
        <path className="skin-s" d="M66 56h11v14a5.500 5.500 0 0 1-11 0z" />
        <ellipse className="skin" cx="74" cy="38" rx="17" ry="19" />
        <path className="skin" d="M89.500 36c5 3 6.500 6 4.500 8.500-.8 1-2 1.300-3.500 1.300z" />
        <ellipse className="skin-s" cx="66" cy="41" rx="3.600" ry="5" />
        <path className="hair" d="M56.500 36c-2-17 12-22 24-19 9 2 12 9 11 14-5-5-13-6-20-4-5 2-8 7-9 14-2 3-5 1-6-5z" />
        <path className="hair-hl" d="M64 22c5-3 11-3.500 15-2.500" />
        <circle className="lens" cx="82" cy="38" r="6.800" />
        <path className="frame" d="M75.200 37.500 68 37.500M88.800 38.500l4 1.500" />
        <g className="eye"><circle cx="83.500" cy="38.500" r="1.900" /></g>
        <path className="brow" d="M77 30.500q5-2.600 11-.6" />
        <path className="mouth" d="M81.500 49.500q4 3.200 8.500.2" />
        <circle className="blush" cx="80" cy="46" r="3.600" />
      </g>

      {/* braço da frente + prancheta com a ficha */}
      <g className="arm arm-f">
        <path className="sleeve" d="M65.500 82h13v31a6.500 6.500 0 0 1-13 0z" />
        <g className="fore fore-f">
          <path className="sleeve" d="M66 108h11l15 -8a5.500 5.500 0 0 1 5.500 9.500l-17 11a6.500 6.500 0 0 1-9-1.500z" />
          <g className="board">
            <rect className="board-b" x="89" y="82" width="23" height="32" rx="3" transform="rotate(-6 100 98)" />
            <rect className="board-p" x="91.500" y="86" width="18" height="25" rx="1.500" transform="rotate(-6 100 98)" />
            <rect className="board-c" x="96" y="80" width="9" height="5.500" rx="1.800" transform="rotate(-6 100 98)" />
            <path className="board-l" d="M94 92h12M94 96.500h12M94 101h8" transform="rotate(-6 100 98)" />
          </g>
          <circle className="skin" cx="93.500" cy="106" r="5" />
        </g>
      </g>

      {/* balão de dúvida (pose “decidindo”) */}
      <g className="ask">
        <path className="bubble" d="M84 -6h34a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8h-22l-9 8 1-8h-4a8 8 0 0 1-8-8V2a8 8 0 0 1 8-8z" transform="translate(-4 4)" />
        <text x="105" y="26" textAnchor="middle">?</text>
      </g>
    </svg>
  )
}
