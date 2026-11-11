import type { Engine } from './engine';
import { clone } from './engine';

export interface BstNode {
  v: number;
  l: number | null;
  r: number | null;
}

export interface BstState {
  nodes: BstNode[];
  root: number | null;
  queue: number[];
  k: number; // índice de la clave que se está insertando
  cursor: number | null;
  done: boolean;
  comps: number;
}

const lado = (izq: boolean) => (izq ? 'izquierda' : 'derecha');

function normalize(s: BstState): void {
  if (s.root === null && s.queue.length > 0) {
    s.nodes.push({ v: s.queue[0], l: null, r: null });
    s.root = 0;
    s.k = 1;
  }
  s.cursor = s.root;
  if (s.k >= s.queue.length) {
    s.done = true;
    s.cursor = null;
  }
}

export function bstHeight(s: BstState): number {
  const h = (i: number | null): number => (i === null ? 0 : 1 + Math.max(h(s.nodes[i].l), h(s.nodes[i].r)));
  return h(s.root);
}

export const bst: Engine<BstState> = {
  id: 'bst',
  nombre: 'Árbol binario de búsqueda',
  escena: 'Un sistema de avenidas que se bifurcan: en cada cruce los valores menores giran a la izquierda y los mayores a la derecha.',
  pseudocodigo: [
    'insertar(raíz, x):',
    '  nodo ← raíz',
    '  repetir',
    '    si x < nodo.valor: ir a la izquierda',
    '    si no: ir a la derecha',
    '  hasta encontrar un lote vacío',
    '  construir x en ese lote',
  ],
  acciones: ['left', 'right'],

  init(ex) {
    const s: BstState = { nodes: [], root: null, queue: [...(ex.inserciones ?? ex.datos ?? [])], k: 0, cursor: null, done: false, comps: 0 };
    normalize(s);
    return s;
  },

  done: (s) => s.done,

  expected(s) {
    if (s.done || s.cursor === null) return [];
    return s.queue[s.k] < s.nodes[s.cursor].v ? [{ kind: 'left' }] : [{ kind: 'right' }];
  },

  step(s, act) {
    if (s.done || s.cursor === null) return { ok: false, state: s, message: 'Todas las avenidas están construidas.' };
    if (act.kind !== 'left' && act.kind !== 'right') {
      return { ok: false, state: s, error: 'comando-no-valido', message: 'En el árbol di "izquierda" o "derecha" en cada cruce.' };
    }
    const x = s.queue[s.k];
    const v = s.nodes[s.cursor].v;
    const izq = x < v;
    if ((act.kind === 'left') !== izq) {
      return {
        ok: false, state: s, error: 'insertar-bst',
        message: `Embotellamiento: el ${x} tomó la avenida equivocada en el cruce ${v}.`,
        why: `${x} ${izq ? '<' : '≥'} ${v}: en un árbol binario de búsqueda los menores van a la izquierda y los mayores o iguales a la derecha.`,
      };
    }
    const n = clone(s);
    n.comps++;
    const nodo = n.nodes[n.cursor!];
    const hijo = izq ? nodo.l : nodo.r;
    if (hijo === null) {
      n.nodes.push({ v: x, l: null, r: null });
      if (izq) nodo.l = n.nodes.length - 1;
      else nodo.r = n.nodes.length - 1;
      n.k++;
      normalize(n);
      const siguiente = n.done ? '' : ` Ahora llega el ${n.queue[n.k]}.`;
      return { ok: true, state: n, message: `Bien: ${x} ${izq ? '<' : '≥'} ${v}. El lote de la ${lado(izq)} está libre: ahí se construye el ${x}.`, milestone: siguiente.trim() || undefined };
    }
    n.cursor = hijo;
    return { ok: true, state: n, message: `Bien: ${x} ${izq ? '<' : '≥'} ${v}, sigue por la avenida de la ${lado(izq)} hasta el cruce ${n.nodes[hijo].v}.` };
  },

  line: (s) => (s.done ? 6 : 3),
  focus: (s) => (s.cursor === null ? {} : { indices: [s.cursor] }),

  intro(s) {
    if (s.done || s.cursor === null) return 'Todas las avenidas están construidas.';
    return `Insertando ${s.queue[s.k]}. Estás en el cruce ${s.nodes[s.cursor].v}: ¿giras a la izquierda o a la derecha?`;
  },

  describe(s) {
    const recorrido: number[] = [];
    const inorden = (i: number | null) => {
      if (i === null) return;
      inorden(s.nodes[i].l);
      recorrido.push(s.nodes[i].v);
      inorden(s.nodes[i].r);
    };
    inorden(s.root);
    const pendientes = s.queue.slice(s.k);
    return `Árbol con ${s.nodes.length} nodos (en orden: ${recorrido.join(', ')}), raíz ${s.root === null ? '-' : s.nodes[s.root].v}. Pendientes por insertar: [${pendientes.join(', ')}]${s.cursor !== null ? `; cruce actual ${s.nodes[s.cursor].v}` : ''}.`;
  },

  hints(s) {
    if (s.cursor === null) return ['', '', ''];
    const x = s.queue[s.k], v = s.nodes[s.cursor].v;
    return [
      'En cada cruce compara el valor que llega con el valor del cruce, nada más.',
      `¿${x} es menor que ${v}?`,
      `Ejemplo: si llega el 45 al cruce 50, como 45 < 50 gira a la izquierda. Aquí ${x} ${x < v ? '<' : '≥'} ${v}, así que di "${x < v ? 'izquierda' : 'derecha'}".`,
    ];
  },

  final: (s) => `¡Red de avenidas construida! ${s.nodes.length} cruces y altura ${bstHeight(s)}.`,
};
