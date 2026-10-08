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
Logos em `public/logos/` (`skema-branca.png`, `skema.png`, `rede-oftalmo.png`); troque por arquivos oficiais mantendo os nomes. Identidade: Brand Book SKEMA (azul #1d2a61, off-white #f6f5f3, verde-menta #80bba9 só em detalhes, Montserrat) — tokens no topo de `src/index.css`.

## Estrutura do site (versão 4.0)
- **Abertura com resultados** (`Hero.tsx`): KPIs que contam até o valor e as etapas mais longas; botão **Iniciar jornada** (também na barra superior) leva direto à animação, sem precisar rolar a página.
- **Resultados que aparecem ao rolar** (`Reveal.tsx`, `Explorer.tsx`): o gráfico muda de leitura (média, mediana, maior tempo, nº de medições) conforme a rolagem e também por clique, com as barras reordenando em animação.
- **Jornada do paciente** (`Journey.tsx`, `Patient.tsx`, `lib/walk.ts`): o paciente percorre o fluxo real (grafo do BPMN). **Em cada decisão a pessoa escolhe o caminho** (botões ou teclas 1/2), pode voltar e escolher o outro. Setas ← → navegam. Três visuais de paciente.
- **Fluxograma** (`BpmnViewer.tsx`): botão "Percorrer o fluxo escolhendo os caminhos" destaca o percurso no diagrama.
- A seção "Notas sobre os dados" foi removida do site.

## Dados
`Cronoanalise_Rede_Oftalmo.xlsx` e `Agenda_horarios.xlsx` em `source/` conferidos com as planilhas enviadas (idênticas; nenhum número mudou). `processes.json` agora inclui as ligações (`flows`) do fluxograma, usadas para o percurso.
- Campo visual: durações com fórmula errada foram recalculadas a partir de início/fim; valores inválidos foram desconsiderados.
- Exame de córnea e Teste de lente não têm medições na planilha; mostram só o fluxograma e o tempo escrito no diagrama.
- `Agenda_horarios.xlsx` só confere que seus tempos já estão na cronoanálise.
