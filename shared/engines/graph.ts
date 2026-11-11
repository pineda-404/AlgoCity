import type { Action, Exercise, GraphData } from '../types';
import type { Engine, StepResult } from './engine';
import { clone, norm } from './engine';

export interface Adj {
  to: string;
  w: number;
}

export interface GraphState {
  nodes: string[];
  adj: Record<string, Adj[]>;
  start: string;
  target: string | null;
  /** BFS: cola de estaciones descubiertas. */
  queue: string[];
  /** Distancia en saltos (BFS) o en minutos (Dijkstra); null = ∞ / no descubierta. */
  dist: Record<string, number | null>;
  parent: Record<string, string | null>;
  /** Estaciones visitadas (BFS) o fijadas (Dijkstra), en orden. */
  order: string[];
  last: string | null;
  done: boolean;
  comps: number;
}

export function buildAdj(g: GraphData): Record<string, Adj[]> {
  const adj: Record<string, Adj[]> = {};
  for (const n of g.nodos) adj[n] = [];
  for (const e of g.aristas) {
    const [u, v] = e;
    const w = e.length === 3 ? e[2] : 1;
    if (!(u in adj) || !(v in adj)) continue;
    adj[u].push({ to: v, w });
    adj[v].push({ to: u, w });
  }
  return adj;
}

function initGraph(ex: Exercise): GraphState {
  const g = ex.grafo ?? { nodos: [], aristas: [] };
  const start = ex.inicio && g.nodos.includes(ex.inicio) ? ex.inicio : g.nodos[0];
  const dist: Record<string, number | null> = {};
  const parent: Record<string, string | null> = {};
  for (const n of g.nodos) {
    dist[n] = null;
    parent[n] = null;
  }
  dist[start] = 0;
  return {
    nodes: [...g.nodos], adj: buildAdj(g), start,
    target: ex.destino && g.nodos.includes(ex.destino) ? ex.destino : null,
    queue: [start], dist, parent, order: [], last: null, done: g.nodos.length === 0, comps: 0,
  };
}

/** Busca una estación por nombre aproximado ("pabellon r", "b", "ctic"). */
export function matchNode(nodes: string[], texto: string): string | null {
  const t = norm(texto)
    .replace(/\bpabellon\b/g, 'pab')
    .replace(/\b(uno|dos|tres|cuatro|cinco)\b/g, (w) => String(['uno', 'dos', 'tres', 'cuatro', 'cinco'].indexOf(w) + 1))
    .replace(/^((a|al|la|el|los|las|estacion|nodo|vertice|del|de)\s+)+/, '')
    .trim();
  if (!t) return null;
  const exact = nodes.find((n) => norm(n) === t);
  if (exact) return exact;
  const tokens = t.split(' ');
  // Nombres cortos ("A", "B2") solo coinciden como palabra completa; los largos, como fragmento.
  const coincide = (n: string) => {
    const k = norm(n);
    if (k.length <= 2) return tokens.includes(k);
    return (t.length >= 3 && k.includes(t)) || t.includes(k);
  };
  const contiene = nodes.filter(coincide);
  if (contiene.length === 1) return contiene[0];
  if (contiene.length > 1) return contiene.sort((a, b) => norm(b).length - norm(a).length).find((n) => t.includes(norm(n))) ?? null;
  return null;
}

export function pathTo(s: GraphState, target: string): string[] {
  if (s.dist[target] === null) return [];
  const path: string[] = [];
  let cur: string | null = target;
  while (cur) {
    path.unshift(cur);
    cur = s.parent[cur];
  }
  return path;
}

function visitError(s: GraphState, a: Action): StepResult<GraphState> | null {
  if (a.kind !== 'visit') {
    return { ok: false, state: s, error: 'comando-no-valido', message: 'En la red de metro di "visita" y el nombre de la estación.' };
  }
  if (!s.nodes.includes(a.node)) {
    return { ok: false, state: s, error: 'comando-no-valido', message: `No encuentro la estación "${a.node}" en el mapa.` };
  }
  return null;
}

// ---------------------------------------------------------------- BFS

export const bfs: Engine<GraphState> = {
  id: 'bfs',
  nombre: 'BFS (búsqueda en anchura)',
  escena: 'Una onda se expande por la red de metro: primero las estaciones a 1 salto, luego las de 2 saltos, y así.',
  pseudocodigo: [
    'cola ← [inicio]; marcar inicio',
    'mientras la cola no esté vacía',
    '  u ← sacar el primero de la cola',
    '  para cada vecino v de u',
    '    si v no está marcado',
    '      marcar v; dist[v] ← dist[u] + 1; encolar v',
    'devolver dist',
  ],
  acciones: ['visit'],

  init: initGraph,
  done: (s) => s.done,

  expected(s) {
    if (s.done || s.queue.length === 0) return [];
    const nivel = s.dist[s.queue[0]];
    return s.queue.filter((n) => s.dist[n] === nivel).map((node) => ({ kind: 'visit' as const, node }));
  },

  step(s, a) {
    const e = visitError(s, a);
    if (e) return e;
    const x = (a as { node: string }).node;
    const nivel = s.dist[s.queue[0]] ?? 0;
    if (s.order.includes(x)) {
      return { ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: ${x} ya fue visitada.`, why: 'BFS visita cada estación una sola vez: marca las estaciones para no volver a entrar.' };
    }
    if (!s.queue.includes(x)) {
      return {
        ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: ${x} todavía no fue descubierta.`,
        why: `Solo puedes visitar estaciones que están en la cola: [${s.queue.join(', ')}]. ${x} se descubrirá cuando visites una vecina suya.`,
      };
    }
    if ((s.dist[x] ?? 0) > nivel) {
      const mismas = s.queue.filter((n) => s.dist[n] === nivel);
      return {
        ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: te adelantaste a la onda.`,
        why: `${x} está a ${s.dist[x]} saltos, pero aún quedan estaciones a ${nivel} saltos (${mismas.join(', ')}). BFS termina un nivel antes de pasar al siguiente.`,
      };
    }
    const n = clone(s);
    n.comps++;
    n.queue = n.queue.filter((q) => q !== x);
    n.order.push(x);
    n.last = x;
    const nuevas: string[] = [];
    for (const { to } of n.adj[x]) {
      if (n.dist[to] === null) {
        n.dist[to] = (n.dist[x] ?? 0) + 1;
        n.parent[to] = x;
        n.queue.push(to);
        nuevas.push(to);
      }
    }
    if (n.queue.length === 0) n.done = true;
    const message = `Bien: visitas ${x} (a ${n.dist[x]} ${n.dist[x] === 1 ? 'salto' : 'saltos'}). ${nuevas.length ? `Descubres ${nuevas.join(', ')} y entran a la cola.` : 'No descubre estaciones nuevas.'}`;
    return { ok: true, state: n, message };
  },

  line: (s) => (s.done ? 6 : 2),
  focus: (s) => ({ nodes: s.queue.length ? [s.queue[0]] : [] }),

  intro(s) {
    if (s.done) return 'La onda recorrió toda la red.';
    return `Cola: [${s.queue.join(', ')}]. ¿Qué estación visitas ahora?`;
  },

  describe(s) {
    const d = s.nodes.map((n) => `${n}: ${s.dist[n] ?? '∞'}`).join('; ');
    return `BFS desde ${s.start}. Visitadas en orden: [${s.order.join(', ')}]. Cola: [${s.queue.join(', ')}]. Saltos: ${d}.`;
  },

  hints(s) {
    const primero = s.queue[0] ?? '';
    return [
      'BFS funciona como una cola en el paradero: atiende primero a quien llegó primero.',
      `¿Qué estación está al frente de la cola [${s.queue.join(', ')}]?`,
      `Ejemplo: si la cola es [B, C] visitas B, y sus vecinas nuevas entran al final: [C, D]. Aquí toca "visita ${primero}".`,
    ];
  },

  final(s) {
    const destino = s.target ? ` El destino ${s.target} está a ${s.dist[s.target] ?? '∞'} saltos: ${pathTo(s, s.target).join(' → ')}.` : '';
    return `¡La onda cubrió la red! Orden de visita: ${s.order.join(' → ')}.${destino}`;
  },
};

// ---------------------------------------------------------------- Dijkstra

function minPendiente(s: GraphState): number | null {
  let m: number | null = null;
  for (const n of s.nodes) {
    const d = s.dist[n];
    if (!s.order.includes(n) && d !== null && (m === null || d < m)) m = d;
  }
  return m;
}

export const dijkstra: Engine<GraphState> = {
  id: 'dijkstra',
  nombre: 'Dijkstra (ruta más corta)',
  escena: 'Una red de metro con tramos de distinta duración: se fija siempre la estación más cercana y se actualizan los tiempos de sus vecinas.',
  pseudocodigo: [
    'dist[inicio] ← 0; dist[resto] ← ∞',
    'mientras queden estaciones sin fijar con dist < ∞',
    '  u ← la estación sin fijar con menor dist',
    '  fijar u',
    '  para cada vecino v de u con tramo w',
    '    si dist[u] + w < dist[v]: dist[v] ← dist[u] + w; previo[v] ← u',
    'devolver dist, previo',
  ],
  acciones: ['visit'],

  init(ex) {
    const s = initGraph(ex);
    s.queue = [];
    return s;
  },
  done: (s) => s.done,

  expected(s) {
    const m = minPendiente(s);
    if (m === null) return [];
    return s.nodes.filter((n) => !s.order.includes(n) && s.dist[n] === m).map((node) => ({ kind: 'visit' as const, node }));
  },

  step(s, a) {
    const e = visitError(s, a);
    if (e) return e;
    const x = (a as { node: string }).node;
    if (s.order.includes(x)) {
      return { ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: ${x} ya está fijada.`, why: 'Una estación fijada ya tiene su distancia mínima definitiva; no se vuelve a visitar.' };
    }
    const m = minPendiente(s);
    const d = s.dist[x];
    if (d === null) {
      return {
        ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: ${x} todavía está a ∞.`,
        why: `Aún no conoces ningún camino hasta ${x}. Dijkstra fija la estación sin fijar con menor distancia conocida (${m}).`,
      };
    }
    if (m !== null && d > m) {
      const mejor = s.nodes.filter((n) => !s.order.includes(n) && s.dist[n] === m);
      return {
        ok: false, state: s, error: 'visitar-nodo', message: `Embotellamiento: ${x} no es la más cercana.`,
        why: `${x} está a ${d} min, pero ${mejor.join(' o ')} está a ${m} min. Si fijas ${x} ahora podrías perder un camino más corto.`,
      };
    }
    const n = clone(s);
    n.order.push(x);
    n.last = x;
    const cambios: string[] = [];
    for (const { to, w } of n.adj[x]) {
      if (n.order.includes(to)) continue;
      n.comps++;
      const nd = (n.dist[x] ?? 0) + w;
      const antes = n.dist[to];
      if (antes === null || nd < antes) {
        n.dist[to] = nd;
        n.parent[to] = x;
        cambios.push(`${to}: ${antes ?? '∞'} → ${nd}`);
      }
    }
    if (minPendiente(n) === null) n.done = true;
    const message = `Bien: fijas ${x} a ${d} min. ${cambios.length ? `Actualizas ${cambios.join(', ')}.` : 'Ninguna vecina mejora su tiempo.'}`;
    return { ok: true, state: n, message };
  },

  line: (s) => (s.done ? 6 : 2),
  focus(s) {
    const m = minPendiente(s);
    return { nodes: s.nodes.filter((n) => !s.order.includes(n) && s.dist[n] !== null && s.dist[n] === m) };
  },

  intro(s) {
    if (s.done) return 'Todas las rutas más cortas están calculadas.';
    const conocidas = s.nodes.filter((n) => !s.order.includes(n) && s.dist[n] !== null).map((n) => `${n} ${s.dist[n]}`);
    return `Estaciones sin fijar con tiempo conocido: ${conocidas.join(', ')}. ¿Cuál fijas ahora?`;
  },

  describe(s) {
    const d = s.nodes.map((n) => `${n}: ${s.dist[n] ?? '∞'}${s.order.includes(n) ? ' (fijada)' : ''}`).join('; ');
    return `Dijkstra desde ${s.start}${s.target ? ` hacia ${s.target}` : ''}. Distancias en minutos: ${d}.`;
  },

  hints(s) {
    const exp = dijkstra.expected(s)[0];
    const nombre = exp && exp.kind === 'visit' ? exp.node : '';
    return [
      'Mira solo las estaciones que aún no están fijadas y que ya tienen un tiempo distinto de ∞.',
      '¿Cuál de esas estaciones tiene el menor tiempo acumulado desde el inicio?',
      `Ejemplo: si B está a 2 min y C a 4 min, se fija B porque ningún camino por C puede llegar a B en menos de 2. Aquí toca "visita ${nombre}".`,
    ];
  },

  final(s) {
    if (s.target) {
      const p = pathTo(s, s.target);
      return `¡Ruta calculada! De ${s.start} a ${s.target}: ${p.join(' → ')} en ${s.dist[s.target]} min.`;
    }
    return `¡Red calculada! Tiempos desde ${s.start}: ${s.nodes.map((n) => `${n} ${s.dist[n] ?? '∞'}`).join(', ')}.`;
  },
};
