# Mapeamento de Processos · Rede Oftalmo × SKEMA Consultoria Júnior

Site de entrega (React + Vite + TypeScript + Tailwind + Recharts + bpmn-js).

## Rodar
```
npm install
npm run dev        # desenvolvimento
npm run build      # gera /dist (pronto para Vercel; framework: Vite)
```

## Dados — nada digitado à mão
`npm run data` (Python 3 + openpyxl) lê **`source/`** e gera `public/data/*.json` e `public/bpmn/*.bpmn`:
- `source/Cronoanalise_Rede_Oftalmo.xlsx` → medições por etapa (`measurements.json`)
- `source/*.bpm` (Bizagi) → convertidos de XPDL para BPMN 2.0, preservando posições, raias e setas
Para atualizar: substitua os arquivos em `source/`, rode `npm run data` e `npm run build`.

## Logos
Coloque `skema.svg|png` e `rede-oftalmo.svg|png` em `public/logos/` (nenhuma logo veio nos arquivos recebidos; até lá aparece só o nome em texto). Cores no topo de `src/index.css`.

## Associações e ressalvas (também visíveis no site, seção “Notas sobre os dados”)
- A planilha se intitula “Córnea”, mas suas etapas são as do fluxograma de **Glaucoma**; as medições foram associadas a ele.
- **Exame de córnea** e **Teste de lente** não têm medições na planilha; mostram só o fluxograma e o tempo total escrito no próprio diagrama (16:05 e 41:52, interpretados como mm:ss).
- Associação etapa↔medição por tarefa (marcada como “provável”): Recepção (Portaria) → tarefas Portaria e Recepção; Auto refratário → Refração; Tonometria de sopro e Retinografia → Mapeamento de retina e tonometria. Microscopia, Topografia, OCT, Paquimetria, Campo visual, Glaucoma Consulta e Pós-consulta ficam ligados à raia “Exames”. “Atendimento Glaucoma” não tem tarefa equivalente.
- Cada etapa foi medida em pacientes diferentes: não há tempo total de jornada (as colunas de total da planilha dão #REF!).
- Campo visual: 20 durações com fórmula apontando para a linha errada foram recalculadas a partir de início/fim; valores inválidos (ex.: “00:17”, “x”) foram desconsiderados e listados por etapa.
- Valores como 1 h 15 min (Campo visual, linha 40) foram mantidos e sinalizados “acima do usual”.
