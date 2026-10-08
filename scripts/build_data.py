#!/usr/bin/env python3
"""Gera public/bpmn/*.bpmn e public/data/*.json a partir dos arquivos originais em /source.
Nada é digitado à mão: todos os números vêm da planilha e todos os fluxos dos .bpm (Bizagi)."""
import zipfile, io, json, re, statistics, datetime, os, sys
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape, quoteattr
import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'source'); OUT_B = os.path.join(ROOT, 'public/bpmn'); OUT_D = os.path.join(ROOT, 'public/data')
os.makedirs(OUT_B, exist_ok=True); os.makedirs(OUT_D, exist_ok=True)
NS = '{http://www.wfmc.org/2009/XPDL2.2}'
Q = lambda t: NS + t
clean = lambda s: re.sub(r'\s+', ' ', (s or '').replace('\xa0', ' ')).strip()

# ---------------------------------------------------------------- BPMN
PROCS = [
  dict(id='glaucoma', file='Fluxograma_Glaucoma.bpm', title='Glaucoma', short='Jornada do paciente com glaucoma'),
  dict(id='exame-de-cornea', file='Diagrama_Cornea.bpmn', title='Exame de córnea', short='Exame de córnea (paciente nova)'),
  dict(id='teste-de-lente', file='Diagrama_Teste_de_lente.bpmn', title='Teste de lente', short='Consulta de teste de lente'),
]

def read_diagram(path):
    """devolve o Diagram.xml (XPDL) que contém um processo com atividades"""
    outer = zipfile.ZipFile(path)
    best = None
    for n in outer.namelist():
        if not n.endswith('.diag'): continue
        inner = zipfile.ZipFile(io.BytesIO(outer.read(n)))
        root = ET.fromstring(inner.read('Diagram.xml'))
        n_act = len(list(root.iter(Q('Activity'))))
        if best is None or n_act > best[0]: best = (n_act, root)
    return best[1]

def argb(v):
    v = int(v) & 0xFFFFFFFF
    return '#%02x%02x%02x' % ((v >> 16) & 255, (v >> 8) & 255, v & 255)


def via_map(nodes, flows):
    """rótulo (Sim/Não…) do fluxo que sai de uma decisão e chega ao nó"""
    kinds = {n['id']: n['kind'] for n in nodes}; v = {}
    for f in flows:
        if kinds.get(f['src']) == 'exclusiveGateway' and f['name']: v[f['dst']] = f['name']
    return v


def seq_map(nodes, flows):
    """ordem causal do percurso: ordenação topológica pelos fluxos (laços de volta ignorados), desempate pela posição x no desenho"""
    import heapq
    byid = {n['id']: n for n in nodes}; succ = {n['id']: [] for n in nodes}
    for f in flows: succ[f['src']].append(f['dst'])
    back = set(); state = {}
    def dfs(u):
        state[u] = 1
        for v in succ[u]:
            if state.get(v) == 1: back.add((u, v))
            elif v not in state: dfs(v)
        state[u] = 2
    for n in sorted(nodes, key=lambda n: n['x']):
        if n['kind'] == 'startEvent' and n['id'] not in state: dfs(n['id'])
    for n in nodes:
        if n['id'] not in state: dfs(n['id'])
    indeg = {n['id']: 0 for n in nodes}
    for f in flows:
        if (f['src'], f['dst']) not in back: indeg[f['dst']] += 1
    heap = [(byid[i]['x'], byid[i]['y'], i) for i, d in indeg.items() if d == 0]; heapq.heapify(heap); order = {}
    while heap:
        _, _, u = heapq.heappop(heap); order[u] = len(order)
        for v in succ[u]:
            if (u, v) in back: continue
            indeg[v] -= 1
            if indeg[v] == 0: heapq.heappush(heap, (byid[v]['x'], byid[v]['y'], v))
    return order

def node_out(n, via, seq):
    return dict(id=n['id'], name=n['name'], kind=n['kind'], lane=n['lane'], doc=n['doc'], gw=n['gw'], x=round(n['x']), y=round(n['y']), via=via.get(n['id']), seq=seq.get(n['id']))

def convert(proc):
    root = read_diagram(os.path.join(SRC, proc['file']))
    # pool real = a que tem lanes ou atividades
    wp = [w for w in root.iter(Q('WorkflowProcess')) if list(w.iter(Q('Activity')))][0]
    pool = [p for p in root.find(Q('Pools')) if p.get('Process') == wp.get('Id')][0]
    pg = pool.find(Q('NodeGraphicsInfos'))[0]; pc = pg.find(Q('Coordinates'))
    px, py, pw, ph = float(pc.get('XCoordinate')), float(pc.get('YCoordinate')), float(pg.get('Width')), float(pg.get('Height'))
    lanes = []
    for l in pool.find(Q('Lanes')):
        g = l.find('.//' + Q('NodeGraphicsInfo')); c = g.find(Q('Coordinates'))
        lanes.append(dict(id='Lane_' + l.get('Id')[:8], name=clean(l.get('Name')),
                          x=px + float(c.get('XCoordinate')), y=py + float(c.get('YCoordinate')),
                          w=float(g.get('Width')), h=float(g.get('Height'))))
    nodes = []
    for a in wp.iter(Q('Activity')):
        g = a.find('.//' + Q('NodeGraphicsInfo')); c = g.find(Q('Coordinates'))
        x, y, w, h = float(c.get('XCoordinate')), float(c.get('YCoordinate')), float(g.get('Width')), float(g.get('Height'))
        ev, rt = a.find(Q('Event')), a.find(Q('Route'))
        if ev is not None:
            kind = 'startEvent' if ev.find(Q('StartEvent')) is not None else 'endEvent'
        elif rt is not None:
            kind = 'exclusiveGateway'
        else:
            kind = 'task'
        doc = a.find(Q('Documentation'))
        nodes.append(dict(id='Node_' + a.get('Id')[:8], guid=a.get('Id'), name=clean(a.get('Name')), kind=kind,
                          x=x, y=y, w=w, h=h, doc=clean(doc.text) if doc is not None and doc.text else '',
                          gw=(rt.get('GatewayDirection') if rt is not None else None)))
    for n in nodes:
        cy = n['y'] + n['h'] / 2
        n['lane'] = next((l['id'] for l in lanes if l['y'] <= cy <= l['y'] + l['h']), None)
    flows = []
    for t in wp.iter(Q('Transition')):
        cg = t.find('.//' + Q('ConnectorGraphicsInfo'))
        pts = [(float(c.get('XCoordinate')), float(c.get('YCoordinate'))) for c in cg.iter(Q('Coordinates'))]
        flows.append(dict(id='Flow_' + t.get('Id')[:8], src='Node_' + t.get('From')[:8], dst='Node_' + t.get('To')[:8],
                          name=clean(t.get('Name')), pts=pts))
    ids = {n['id'] for n in nodes}
    assert all(f['src'] in ids and f['dst'] in ids for f in flows), 'transição aponta para nó inexistente'
    inc = {n['id']: [] for n in nodes}; out = {n['id']: [] for n in nodes}
    for f in flows: out[f['src']].append(f['id']); inc[f['dst']].append(f['id'])
    pool_name = clean(pool.get('Name'))
    P = []
    P.append('<?xml version="1.0" encoding="UTF-8"?>')
    P.append('<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_%s" targetNamespace="http://skema.jr/rede-oftalmo">' % proc['id'])
    P.append('<bpmn:collaboration id="Collab_1"><bpmn:participant id="Pool_1" name=%s processRef="Process_1" /></bpmn:collaboration>' % quoteattr(pool_name))
    P.append('<bpmn:process id="Process_1" isExecutable="false">')
    if lanes:
        P.append('<bpmn:laneSet id="LaneSet_1">')
        for l in lanes:
            P.append('<bpmn:lane id="%s" name=%s>' % (l['id'], quoteattr(l['name'])))
            for n in nodes:
                if n['lane'] == l['id']: P.append('<bpmn:flowNodeRef>%s</bpmn:flowNodeRef>' % n['id'])
            P.append('</bpmn:lane>')
        P.append('</bpmn:laneSet>')
    for n in nodes:
        nm = (' name=%s' % quoteattr(n['name'])) if n['name'] else ''
        P.append('<bpmn:%s id="%s"%s>' % (n['kind'], n['id'], nm))
        if n['doc']: P.append('<bpmn:documentation>%s</bpmn:documentation>' % escape(n['doc']))
        for i in inc[n['id']]: P.append('<bpmn:incoming>%s</bpmn:incoming>' % i)
        for o in out[n['id']]: P.append('<bpmn:outgoing>%s</bpmn:outgoing>' % o)
        P.append('</bpmn:%s>' % n['kind'])
    for f in flows:
        nm = (' name=%s' % quoteattr(f['name'])) if f['name'] else ''
        P.append('<bpmn:sequenceFlow id="%s" sourceRef="%s" targetRef="%s"%s />' % (f['id'], f['src'], f['dst'], nm))
    P.append('</bpmn:process>')
    P.append('<bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">')
    P.append('<bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true"><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNShape>' % (px, py, pw, ph))
    for l in lanes:
        P.append('<bpmndi:BPMNShape id="%s_di" bpmnElement="%s" isHorizontal="true"><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNShape>' % (l['id'], l['id'], l['x'], l['y'], l['w'], l['h']))
    for n in nodes:
        mk = ' isMarkerVisible="true"' if n['kind'] == 'exclusiveGateway' else ''
        P.append('<bpmndi:BPMNShape id="%s_di" bpmnElement="%s"%s><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNShape>' % (n['id'], n['id'], mk, n['x'], n['y'], n['w'], n['h']))
    for f in flows:
        P.append('<bpmndi:BPMNEdge id="%s_di" bpmnElement="%s">' % (f['id'], f['id']))
        for (x, y) in f['pts']: P.append('<di:waypoint x="%g" y="%g" />' % (x, y))
        P.append('</bpmndi:BPMNEdge>')
    P.append('</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>')
    with open(os.path.join(OUT_B, proc['id'] + '.bpmn'), 'w', encoding='utf-8') as fh: fh.write('\n'.join(P))
    return dict(id=proc['id'], title=proc['title'], short=proc['short'], poolName=pool_name, sourceFile=proc['file'],
                bpmn='bpmn/%s.bpmn' % proc['id'],
                lanes=[dict(id=l['id'], name=l['name']) for l in lanes],
                nodes=[node_out(n, via_map(nodes, flows), seq_map(nodes, flows)) for n in nodes],
                flows=[dict(id=f['id'], src=f['src'], dst=f['dst'], name=f['name']) for f in flows],
                counts=dict(tasks=sum(n['kind'] == 'task' for n in nodes), gateways=sum(n['kind'] == 'exclusiveGateway' for n in nodes),
                            events=sum(n['kind'].endswith('Event') for n in nodes), flows=len(flows), lanes=len(lanes)))


# ---- importador de BPMN 2.0 (export do Bizagi) -> BPMN limpo para o bpmn-js
BM = '{http://www.omg.org/spec/BPMN/20100524/MODEL}'
BD = '{http://www.omg.org/spec/BPMN/20100524/DI}'
DC = '{http://www.omg.org/spec/DD/20100524/DC}'
DI_ = '{http://www.omg.org/spec/DD/20100524/DI}'

def convert_bpmn(proc):
    root = ET.parse(os.path.join(SRC, proc['file'])).getroot()
    coll = root.find(BM + 'collaboration')
    part = next(p for p in coll.findall(BM + 'participant') if p.get('name'))   # a outra participante é vazia
    pr = next(p for p in root.findall(BM + 'process') if p.get('id') == part.get('processRef'))
    pool_id, pool_name = part.get('id'), clean(part.get('name'))
    shapes = {}; edges = {}
    for sh in root.iter(BD + 'BPMNShape'):
        b = sh.find(DC + 'Bounds'); lb = sh.find(BD + 'BPMNLabel')
        lbb = lb.find(DC + 'Bounds') if lb is not None else None
        shapes[sh.get('bpmnElement')] = dict(x=float(b.get('x')), y=float(b.get('y')), w=float(b.get('width')), h=float(b.get('height')),
            label=(tuple(float(lbb.get(k)) for k in ('x', 'y', 'width', 'height')) if lbb is not None and float(lbb.get('width')) > 0 else None))
    for ed in root.iter(BD + 'BPMNEdge'):
        edges[ed.get('bpmnElement')] = [(float(w.get('x')), float(w.get('y'))) for w in ed.findall(DI_ + 'waypoint')]
    lanes = []
    for l in pr.iter(BM + 'lane'):
        g = shapes[l.get('id')]
        lanes.append(dict(id=l.get('id'), name=clean(l.get('name')), **g, refs=[r.text for r in l.findall(BM + 'flowNodeRef')]))
    KINDS = ('startEvent', 'endEvent', 'task', 'exclusiveGateway')
    nodes = []
    for e in pr:
        k = e.tag.replace(BM, '')
        if k not in KINDS: continue
        g = shapes[e.get('id')]
        doc = e.find(BM + 'documentation')
        n = dict(id=e.get('id'), name=clean(e.get('name')), kind=k, doc=clean(doc.text) if doc is not None and doc.text else '', gw=None, **g)
        cy = g['y'] + g['h'] / 2
        n['lane'] = next((l['id'] for l in lanes if n['id'] in l['refs']), None) or \
                    next((l['id'] for l in lanes if l['y'] <= cy <= l['y'] + l['h']), None)
        nodes.append(n)
    flows = [dict(id=f.get('id'), src=f.get('sourceRef'), dst=f.get('targetRef'), name=clean(f.get('name')), pts=edges[f.get('id')])
             for f in pr.findall(BM + 'sequenceFlow')]
    ids = {n['id'] for n in nodes}
    assert all(f['src'] in ids and f['dst'] in ids for f in flows), 'fluxo aponta para nó inexistente'
    notes = []
    for t in pr.findall(BM + 'textAnnotation'):
        tx = t.find(BM + 'text')
        notes.append(dict(id=t.get('id'), text=clean(tx.text if tx is not None else ''), **shapes[t.get('id')]))
    assocs = [dict(id=a.get('id'), src=a.get('sourceRef'), dst=a.get('targetRef'), pts=edges.get(a.get('id'), [])) for a in pr.findall(BM + 'association')]
    inc = {n['id']: [] for n in nodes}; out = {n['id']: [] for n in nodes}
    for f in flows: out[f['src']].append(f['id']); inc[f['dst']].append(f['id'])
    P = ['<?xml version="1.0" encoding="UTF-8"?>',
         '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Defs_%s" targetNamespace="http://skema.jr/rede-oftalmo">' % proc['id'],
         '<bpmn:collaboration id="Collab_1"><bpmn:participant id="Pool_1" name=%s processRef="Process_1" /></bpmn:collaboration>' % quoteattr(pool_name),
         '<bpmn:process id="Process_1" isExecutable="false"><bpmn:laneSet id="LaneSet_1">']
    for l in lanes:
        P.append('<bpmn:lane id="%s" name=%s>' % (l['id'], quoteattr(l['name'])))
        for n in nodes:
            if n['lane'] == l['id']: P.append('<bpmn:flowNodeRef>%s</bpmn:flowNodeRef>' % n['id'])
        P.append('</bpmn:lane>')
    P.append('</bpmn:laneSet>')
    for n in nodes:
        nm = (' name=%s' % quoteattr(n['name'])) if n['name'] else ''
        P.append('<bpmn:%s id="%s"%s>' % (n['kind'], n['id'], nm))
        if n['doc']: P.append('<bpmn:documentation>%s</bpmn:documentation>' % escape(n['doc']))
        for i in inc[n['id']]: P.append('<bpmn:incoming>%s</bpmn:incoming>' % i)
        for o in out[n['id']]: P.append('<bpmn:outgoing>%s</bpmn:outgoing>' % o)
        P.append('</bpmn:%s>' % n['kind'])
    for f in flows:
        nm = (' name=%s' % quoteattr(f['name'])) if f['name'] else ''
        P.append('<bpmn:sequenceFlow id="%s" sourceRef="%s" targetRef="%s"%s />' % (f['id'], f['src'], f['dst'], nm))
    for t in notes: P.append('<bpmn:textAnnotation id="%s"><bpmn:text>%s</bpmn:text></bpmn:textAnnotation>' % (t['id'], escape(t['text'])))
    for a in assocs: P.append('<bpmn:association id="%s" sourceRef="%s" targetRef="%s" />' % (a['id'], a['src'], a['dst']))
    P.append('</bpmn:process>')
    P.append('<bpmndi:BPMNDiagram id="Diagram_1"><bpmndi:BPMNPlane id="Plane_1" bpmnElement="Collab_1">')
    g = dict(shapes[pool_id])
    band = min(l['x'] for l in lanes) - g['x']          # faixa do título do pool; o export do Bizagi deixa só 10 px
    if band < 40: g['x'] -= 40 - band; g['w'] += 40 - band
    P.append('<bpmndi:BPMNShape id="Pool_1_di" bpmnElement="Pool_1" isHorizontal="true"><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNShape>' % (g['x'], g['y'], g['w'], g['h']))
    for l in lanes:
        P.append('<bpmndi:BPMNShape id="%s_di" bpmnElement="%s" isHorizontal="true"><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNShape>' % (l['id'], l['id'], l['x'], l['y'], l['w'], l['h']))
    for n in list(nodes) + notes:
        mk = ' isMarkerVisible="true"' if n.get('kind') == 'exclusiveGateway' else ''
        lab = ('<bpmndi:BPMNLabel><dc:Bounds x="%g" y="%g" width="%g" height="%g" /></bpmndi:BPMNLabel>' % n['label']) if n.get('label') and n.get('kind') != 'task' else ''
        P.append('<bpmndi:BPMNShape id="%s_di" bpmnElement="%s"%s><dc:Bounds x="%g" y="%g" width="%g" height="%g" />%s</bpmndi:BPMNShape>' % (n['id'], n['id'], mk, n['x'], n['y'], n['w'], n['h'], lab))
    for f in list(flows) + assocs:
        P.append('<bpmndi:BPMNEdge id="%s_di" bpmnElement="%s">' % (f['id'], f['id']))
        for (x, y) in f['pts']: P.append('<di:waypoint x="%g" y="%g" />' % (x, y))
        P.append('</bpmndi:BPMNEdge>')
    P.append('</bpmndi:BPMNPlane></bpmndi:BPMNDiagram></bpmn:definitions>')
    with open(os.path.join(OUT_B, proc['id'] + '.bpmn'), 'w', encoding='utf-8') as fh: fh.write('\n'.join(P))
    return dict(id=proc['id'], title=proc['title'], short=proc['short'], poolName=pool_name, sourceFile=proc['file'],
                bpmn='bpmn/%s.bpmn' % proc['id'],
                lanes=[dict(id=l['id'], name=l['name']) for l in lanes],
                nodes=[node_out(n, via_map(nodes, flows), seq_map(nodes, flows)) for n in nodes],
                flows=[dict(id=f['id'], src=f['src'], dst=f['dst'], name=f['name']) for f in flows],
                notes=[dict(id=t['id'], text=t['text']) for t in notes],
                counts=dict(tasks=sum(n['kind'] == 'task' for n in nodes), gateways=sum(n['kind'] == 'exclusiveGateway' for n in nodes),
                            events=sum(n['kind'].endswith('Event') for n in nodes), flows=len(flows), lanes=len(lanes)))

def convert_any(p):
    return convert_bpmn(p) if p['file'].endswith('.bpmn') else convert(p)

procs = [convert_any(p) for p in PROCS]

# origem de cada etapa do fluxo de córnea: desenho original da equipe × acrescentada a partir da entrevista
_ORIG = {'Node_entender', 'Node_fenda', 'Node_grau', 'Node_grins', 'Node_relatorio', 'Node_entrega'}
for _p in procs:
    for _n in _p['nodes']:
        _n['origin'] = ('diagrama' if _n['id'] in _ORIG else 'entrevista') if _p['id'] == 'exame-de-cornea' else 'diagrama'

# ---------------------------------------------------------------- planilha
wb = openpyxl.load_workbook(os.path.join(SRC, 'Cronoanalise_Rede_Oftalmo.xlsx'), data_only=True)
ws = wb['Coleta de Dados']
FIRST, LAST = 5, 303
def sec(v):
    if isinstance(v, datetime.timedelta): return int(round(v.total_seconds()))
    return None
def tod(v):
    return v.hour * 3600 + v.minute * 60 + v.second if isinstance(v, datetime.time) else None
def hhmm(v): return v.strftime('%H:%M') if isinstance(v, datetime.time) else None
def cell(col, r): return ws['%s%d' % (col, r)].value

quality = []   # lista de observações sobre a qualidade dos dados
steps = []

def add_step(id_, label, phase, samples, excluded=None, **kw):
    vals = [s['seconds'] for s in samples]
    st = dict(id=id_, label=label, phase=phase, n=len(vals),
              mean=round(statistics.mean(vals), 2) if vals else None,
              median=statistics.median(vals) if vals else None,
              min=min(vals) if vals else None, max=max(vals) if vals else None,
              stdev=round(statistics.stdev(vals), 2) if len(vals) > 1 else None,
              samples=samples, excluded=excluded or [], **kw)
    steps.append(st)

# --- blocos "Nº Pacientes / Tempo / Observação" (tempo cronometrado direto, em segundos)
direct = [
  ('recepcao', 'Recepção (Portaria)', 'Chegada', 'C', 'D', 'E'),
  ('atendimento-glaucoma', 'Atendimento Glaucoma', 'Chegada', 'F', 'G', 'H'),
  ('microscopia', 'Microscopia', 'Exames', 'I', 'J', 'K'),
  ('topografia', 'Topografia', 'Exames', 'L', 'M', 'N'),
  ('tonometria-sopro', 'Tonometria de sopro', 'Exames', 'O', 'P', 'Q'),
  ('auto-refratario', 'Auto refratário', 'Exames', 'R', 'S', 'T'),
  ('glaucoma-consulta', 'Glaucoma Consulta', 'Consulta', 'U', 'V', 'W'),
]
for id_, label, phase, cn, ct, co in direct:
    smp, exc = [], []
    for r in range(FIRST, LAST + 1):
        v = cell(ct, r)
        if v in (None, ''): continue
        s = sec(v)
        if s is None:
            exc.append(dict(row=r, raw=str(v), reason='valor não é uma duração')); continue
        obs = cell(co, r)
        smp.append(dict(row=r, obs=cell(cn, r), seconds=s, note=clean(obs) if obs else None))
    add_step(id_, label, phase, smp, exc, source='Colunas %s–%s' % (cn, co), kind='cronometrado')

# --- Campo visual: planilha tem duas colunas (Y = tempo direto; BA/BB/BC = início/fim) para as MESMAS observações.
smp, exc = [], []
for r in range(FIRST, LAST + 1):
    a, b, d, y = cell('BA', r), cell('BB', r), cell('BC', r), cell('Y', r)
    ta, tb = tod(a), tod(b)
    if ta is not None and tb is not None:
        calc = tb - ta
        cached = sec(d)
        item = dict(row=r, obs=cell('A', r), seconds=calc, start=hhmm(a), end=hhmm(b), note=None)
        if cached is not None and cached != calc:
            item['flag'] = 'recalculado'
            item['note'] = 'A planilha trazia %d s (fórmula apontando para outra linha); recalculado a partir do início/fim registrados.' % cached
        smp.append(item)
    elif isinstance(d, datetime.timedelta) and d.total_seconds() > 0 and a == 'x':
        smp.append(dict(row=r, obs=cell('A', r), seconds=sec(d), note='Tempo cronometrado direto (sem horário de início/fim)'))
    # Y fora do bloco 5-13 (valor estranho)
for r in range(FIRST, LAST + 1):
    y = cell('Y', r)
    if y not in (None, '') and not isinstance(y, datetime.timedelta):
        exc.append(dict(row=r, raw=str(y), reason='valor em formato de horário (00:17), não de duração; desconsiderado'))
add_step('campo-visual', 'Campo visual', 'Exames', smp, exc, source='Colunas X–Z e BA–BC', kind='cronometrado / início-fim')

# --- blocos Início/Fim/Duração
def start_end(id_, label, phase, a, b, d):
    smp, exc = [], []
    for r in range(FIRST, LAST + 1):
        sa, sb = cell(a, r), cell(b, r)
        ta, tb = tod(sa), tod(sb)
        if ta is None and tb is None: continue
        if ta is None or tb is None:
            exc.append(dict(row=r, raw='%s – %s' % (sa, sb), reason='início ou fim ausente')); continue
        dur = tb - ta
        if dur < 0:
            exc.append(dict(row=r, raw='%s – %s' % (hhmm(sa), hhmm(sb)), reason='horário de fim anterior ao de início')); continue
        smp.append(dict(row=r, obs=cell('A', r), seconds=dur, start=hhmm(sa), end=hhmm(sb), note=None))
    add_step(id_, label, phase, smp, exc, source='Colunas %s–%s' % (a, d), kind='início / fim')
start_end('oct', 'OCT', 'Exames', 'AR', 'AS', 'AT')
start_end('paquimetria', 'Paquimetria corneana', 'Exames', 'AU', 'AV', 'AW')
start_end('retinografia', 'Retinografia', 'Exames', 'BD', 'BE', 'BF')

# --- Pós-consulta: BG/BH início/fim (linhas 5-8 trazem 'x' e valores sem sentido em BJ -> ignoradas)
smp, exc = [], []
for r in range(FIRST, LAST + 1):
    sa, sb = cell('BG', r), cell('BH', r); ta, tb = tod(sa), tod(sb)
    if ta is None and tb is None:
        if sa == 'x' or sb == 'x': exc.append(dict(row=r, raw='x / x', reason='sem horários registrados (BJ traz valor sem sentido)'))
        continue
    if ta is None or tb is None: exc.append(dict(row=r, raw='%s – %s' % (sa, sb), reason='início ou fim ausente')); continue
    if tb - ta < 0: exc.append(dict(row=r, raw='%s – %s' % (hhmm(sa), hhmm(sb)), reason='horário de fim anterior ao de início')); continue
    smp.append(dict(row=r, obs=cell('A', r), seconds=tb - ta, start=hhmm(sa), end=hhmm(sb), note=None))
add_step('pos-consulta', 'Pós-consulta', 'Pós-consulta', smp, exc, source='Colunas BG–BH (BJ)', kind='início / fim')

# --- Pós-consulta: tempo sem paciente (BI) — intervalo entre atendimentos consecutivos do posto
smp, exc = [], []
for r in range(FIRST, LAST + 1):
    v = cell('BI', r)
    if v in (None, ''): continue
    s = sec(v)
    if s is None: exc.append(dict(row=r, raw=str(v), reason='marcado com "x" (sem valor)')); continue
    smp.append(dict(row=r, obs=cell('A', r), seconds=s, note=None))
add_step('pos-consulta-ociosidade', 'Pós-consulta · tempo sem paciente', 'Pós-consulta', smp, exc, source='Coluna BI', kind='intervalo do posto')

# etapas previstas na planilha, mas sem nenhum dado
empty_cols = [('Teste provocativo de Glaucoma', 'AX–AZ'), ('Consulta oftalmológica', 'AD–AF'),
              ('Encaminhamento / Agendamento / Faturamento', 'AG–AI'), ('Horário de saída da clínica', 'AJ'), ('Médico', 'AO')]
empty_steps = []
for name, cols in empty_cols:
    first = cols.split('–')[0]
    assert all(cell(first, r) in (None, '') for r in range(FIRST, LAST + 1)), name
    empty_steps.append(dict(label=name, cols=cols))

# ---------------------------------------------------------------- associação etapa-do-fluxograma ↔ medição (Glaucoma)
g = next(p for p in procs if p['id'] == 'glaucoma')
def node(name_part):
    hits = [n for n in g['nodes'] if name_part.lower() in n['name'].lower() and n['kind'] == 'task']
    assert len(hits) == 1, (name_part, hits)
    return hits[0]['id']
lane_exames = next(l['id'] for l in g['lanes'] if l['name'] == 'Exames')
lane_recep = next(l['id'] for l in g['lanes'] if l['name'] == 'Recepção')
lane_port = next(l['id'] for l in g['lanes'] if l['name'] == 'Portaria')
LINK = {
  'recepcao': dict(process='glaucoma', nodes=[node('Portaria identifica'), node('Recepção abre a ficha')], confidence='provável',
       note='A planilha mede “Recepção (Portaria)” como uma etapa única; no fluxograma ela corresponde às duas tarefas da entrada (Portaria e Recepção). O mesmo tempo é exibido nas duas, sem soma.'),
  'auto-refratario': dict(process='glaucoma', nodes=[node('Refração')], confidence='provável',
       note='O auto refrator é o equipamento da etapa de refração.'),
  'tonometria-sopro': dict(process='glaucoma', nodes=[node('Mapeamento de')], confidence='provável',
       note='A tarefa do fluxograma une “mapeamento de retina e tonometria”; a planilha mede a tonometria de sopro separadamente.'),
  'retinografia': dict(process='glaucoma', nodes=[node('Mapeamento de')], confidence='provável',
       note='A tarefa do fluxograma une “mapeamento de retina e tonometria”; a planilha mede a retinografia separadamente.'),
}
for lane_id, ids in {lane_exames: ['microscopia', 'topografia', 'oct', 'paquimetria', 'campo-visual', 'glaucoma-consulta', 'tonometria-sopro', 'auto-refratario', 'retinografia', 'pos-consulta', 'pos-consulta-ociosidade']}.items(): pass
for s in steps:
    s['process'] = 'glaucoma'
    s['link'] = LINK.get(s['id'], dict(process='glaucoma', nodes=[], confidence='sem etapa equivalente', note=None))
    s['lane'] = None
LANE_STEPS = {  # medições ligadas à raia (não a uma tarefa específica)
  lane_exames: ['microscopia', 'topografia', 'oct', 'paquimetria', 'campo-visual', 'glaucoma-consulta', 'pos-consulta'],
}
for s in steps:
    if s['id'] in LANE_STEPS[lane_exames]:
        s['link'] = dict(process='glaucoma', nodes=[], lane=lane_exames, confidence='raia',
                         note='O fluxograma não detalha este exame/etapa individualmente; a medição é associada à raia “Exames”.')
    if s['id'] == 'atendimento-glaucoma':
        s['link'] = dict(process='glaucoma', nodes=[], confidence='sem etapa equivalente',
                         note='Não há tarefa com este nome no fluxograma; mantida apenas nos dados do processo.')
    if s['id'] == 'pos-consulta-ociosidade':
        s['link'] = dict(process='glaucoma', nodes=[], confidence='sem etapa equivalente',
                         note='Intervalo em que o posto de pós-consulta ficou sem paciente; não é uma etapa da jornada.')

# observações de campo (tags)
quality = [
 dict(id='titulo', level='atenção', title='Título da planilha × conteúdo', text='A planilha se intitula “Consulta e Exames de Córnea”, mas as etapas medidas (Atendimento Glaucoma, Glaucoma Consulta, Teste provocativo de Glaucoma, tonometria, OCT, campo visual…) correspondem ao fluxograma de Glaucoma. As medições foram associadas ao processo de Glaucoma.'),
 dict(id='sem-medicoes', level='atenção', title='Córnea e Teste de lente sem medições', text='Não há medições para “Exame de córnea” e “Teste de lente” na planilha recebida. Para esses processos o site mostra apenas o fluxograma e o tempo escrito no próprio diagrama (16:05, que vale só para a etapa de consulta, no fluxograma de córnea; e 41:52 no Teste de lente).'),
 dict(id='independentes', level='info', title='Medições independentes por etapa', text='Cada etapa tem a sua própria contagem de pacientes (“Nº Pacientes”), ou seja, as etapas não foram cronometradas para os mesmos pacientes. Por isso o site não soma etapas nem calcula tempo total de permanência — as colunas de totais da planilha também estão com erro (#REF!).'),
 dict(id='campo-visual', level='corrigido', title='Campo visual — durações recalculadas', text='Em %d observações a coluna de duração (BC) tinha fórmulas apontando para a linha errada. A duração foi recalculada a partir do início e fim registrados nas colunas BA/BB; cada linha afetada está marcada na tabela.' % sum(1 for s in steps if s['id']=='campo-visual' for x in s['samples'] if x.get('flag'))),
 dict(id='excluidos', level='corrigido', title='Valores desconsiderados', text='Foram desconsiderados valores que não são durações válidas (ex.: horário “00:17” na coluna de Campo visual; “x” nas linhas 5–8 de Pós-consulta). Todos estão listados em cada etapa. Nenhum valor válido foi alterado.'),
 dict(id='vazias', level='info', title='Etapas previstas sem dados', text='Previstas na planilha, mas sem nenhuma medição: ' + '; '.join(e['label'] for e in empty_steps) + '.'),
 dict(id='entrevista', level='atenção', title='Fluxograma de córnea ampliado com a entrevista', text='O desenho original da córnea cobria só o atendimento técnico. A parte da portaria, recepção, exames, decisão de agendar e marcação foi acrescentada a partir da entrevista com a equipe da córnea e da estrutura do fluxograma de Glaucoma, e depois revisada no diagrama atualizado. Cada etapa informa sua origem.'),
 dict(id='outliers', level='info', title='Valores extremos', text='Os valores foram mantidos como registrados. Valores muito acima da mediana aparecem destacados nos gráficos e tabelas e merecem conferência em campo.'),
]

# ---------------------------------------------------------------- agenda de horários × cronoanálise (sem contar 2 vezes)
import math
ag_ws = openpyxl.load_workbook(os.path.join(SRC, 'Agenda_horarios.xlsx'), data_only=True)['Horários']
ag_rows = [r for r in ag_ws.iter_rows(min_row=2, values_only=True) if r[0]]
hm = lambda t: t.strftime('%H:%M') if hasattr(t, 'strftime') else None
AG_COLS = {'campo-visual': (4, 5), 'retinografia': (6, 7), 'paquimetria': (8, 9), 'oct': (10, 11)}
have = {(st['id'], x.get('start'), x.get('end')) for st in steps for x in st['samples'] if x.get('start')}
ag_total = ag_match = 0
for r in ag_rows:
    for sid, (a, b) in AG_COLS.items():
        if r[a] and r[b]:
            ag_total += 1; ag_match += (sid, hm(r[a]), hm(r[b])) in have
ag_dates = sorted({datetime.datetime.strptime(r[0], '%d/%m/%Y').date() for r in ag_rows})
print('agenda: %d pacientes, %d tempos de exame, %d já na cronoanálise' % (len(ag_rows), ag_total, ag_match))
quality.append(dict(id='agenda', level='info', title='Agenda de horários já está na cronoanálise',
    text='A planilha “agenda de horários” (%d pacientes em %s) traz Campo visual, Retinografia, Paquimetria e OCT. Dos %d tempos de exame dela, %d já constam na cronoanálise (mesmo início e fim) e não foram somados de novo: o site usa só a cronoanálise.' % (
        len(ag_rows), ' e '.join(d.strftime('%d/%m') for d in ag_dates), ag_total, ag_match)))

# ---------------------------------------------------------------- cronograma de coleta
PLAN_TARGET, PLAN_PER_VISIT, PLAN_PER_WEEK = 100, 35, 2
PLAN_EXCLUDED = ['oct', 'campo-visual', 'retinografia', 'paquimetria']
plan_steps = [st for st in steps if st['id'] not in PLAN_EXCLUDED and st['id'] != 'pos-consulta-ociosidade']
rows_ = [dict(id=st['id'], label=st['label'], n=st['n'], missing=max(0, PLAN_TARGET - st['n']),
              visits=math.ceil(max(0, PLAN_TARGET - st['n']) / PLAN_PER_VISIT)) for st in plan_steps]
n_visits = max(r['visits'] for r in rows_)
weekdays = sorted({d.weekday() for d in ag_dates})                  # dias da semana das visitas já feitas (qui/sex)
d = ag_dates[-1] + datetime.timedelta(days=1); visits_dates = []
while len(visits_dates) < n_visits:
    if d.weekday() in weekdays: visits_dates.append(d)
    d += datetime.timedelta(days=1)
def after(i, r): return min(PLAN_TARGET, r['n'] + PLAN_PER_VISIT * i)
visits_ = []
for i, dt in enumerate(visits_dates, 1):
    visits_.append(dict(n=i, date=dt.isoformat(), closes=[r['label'] for r in rows_ if r['visits'] == i],
                        lowest=min(after(i, r) for r in rows_)))
nxt = d
while nxt.weekday() not in weekdays: nxt += datetime.timedelta(days=1)
plan = dict(target=PLAN_TARGET, perVisit=PLAN_PER_VISIT, perWeek=PLAN_PER_WEEK, excluded=[st['label'] for st in steps if st['id'] in PLAN_EXCLUDED],
            steps=rows_, visits=n_visits, schedule=visits_, lastDone=ag_dates[-1].isoformat(), end=visits_dates[-1].isoformat(), next=nxt.isoformat(),
            bottleneck=[r['label'] for r in rows_ if r['visits'] == n_visits],
            weekdays=weekdays)
print('plano:', n_visits, 'visitas →', plan['end'], [r['label'] + ' ' + str(r['visits']) for r in rows_])

# ---------------------------------------------------------------- rótulos de tempo total dentro dos fluxogramas
for p in procs:
    p['totalLabel'] = None
    for n in p['nodes'] + [dict(name=t['text']) for t in p.get('notes', [])]:
        m = re.search(r'tempo total aprox\.?\s*([0-9]+:[0-9]{2})(.*)$', n['name'])
        if m: p['totalLabel'] = dict(value=m.group(1), note=clean(m.group(2)).strip(' ()'), text=n['name'])
        m2 = re.search(r'só da etapa de consulta.*aprox\.\s*([0-9]+:[0-9]{2})', n['name'])
        if m2: p['totalLabel'] = dict(value=m2.group(1), note='só a etapa de consulta', text=n['name'])

# ---------------------------------------------------------------- saída
json.dump(dict(processes=procs), open(os.path.join(OUT_D, 'processes.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump(dict(source='Cronoanalise_Rede_Oftalmo.xlsx · aba “Coleta de Dados”', unit='segundos', steps=steps,
               plan=plan, emptySteps=empty_steps, laneSteps={k: v for k, v in LANE_STEPS.items()}, quality=quality),
          open(os.path.join(OUT_D, 'measurements.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for s in steps: print('%-34s n=%-3d mean=%-8s med=%-6s min=%-5s max=%-6s exc=%d' % (s['label'], s['n'], s['mean'], s['median'], s['min'], s['max'], len(s['excluded'])))
for p in procs: print(p['id'], p['counts'], p['totalLabel'])
