import type { Engine } from './engine';
import { clone } from './engine';

export interface QuickState {
  a: number[];
  stack: [number, number][];
  cur: { lo: number; hi: number; i: number; j: number } | null;
  fijo: boolean[];
  done: boolean;
  comps: number;
  swaps: number;
}

/** Avanza automáticamente los pasos que no requieren decisión: ubicar el pivote y elegir el siguiente tramo. */
function normalize(s: QuickState, notas: string[]): void {
  for (;;) {
    if (s.cur && s.cur.j >= s.cur.hi) {
      const { lo, hi, i } = s.cur;
      const pivote = s.a[hi];
      if (i !== hi) {
        [s.a[i], s.a[hi]] = [s.a[hi], s.a[i]];
        s.swaps++;
      }
      s.fijo[i] = true;
      notas.push(`El pivote ${pivote} cruza a la posición ${i}: a su izquierda quedan los menores o iguales y a su derecha los mayores.`);
      s.stack.push([i + 1, hi], [lo, i - 1]);
      s.cur = null;
    }
    if (s.cur) return;
    const tramo = s.stack.pop();
    if (!tramo) {
      s.done = true;
      s.fijo = s.fijo.map(() => true);
      return;
    }
    const [lo, hi] = tramo;
    if (lo === hi) s.fijo[lo] = true;
    if (hi - lo >= 1) s.cur = { lo, hi, i: lo, j: lo };
  }
}

export const quick: Engine<QuickState> = {
  id: 'quick',
  nombre: 'Quick Sort',
  escena: 'Una avenida pivote divide el barrio: los edificios menores o iguales al pivote van a la izquierda y los mayores a la derecha.',
  pseudocodigo: [
    'quicksort(A, lo, hi):',
    '  si lo < hi:',
    '    pivote ← A[hi]; i ← lo',
    '    para j ← lo hasta hi-1',
    '      si A[j] ≤ pivote: intercambiar(A[i], A[j]); i ← i+1',
    '    intercambiar(A[i], A[hi])   // el pivote llega a su lugar',
    '    quicksort(A, lo, i-1); quicksort(A, i+1, hi)',
  ],
  acciones: ['left', 'right'],

  init(ex) {
    const a = [...(ex.datos ?? [])];
    const s: QuickState = { a, stack: [[0, a.length - 1]], cur: null, fijo: a.map(() => false), done: false, comps: 0, swaps: 0 };
    normalize(s, []);
    return s;
  },

  done: (s) => s.done,

  expected(s) {
    if (!s.cur) return [];
    return s.a[s.cur.j] <= s.a[s.cur.hi] ? [{ kind: 'left' }] : [{ kind: 'right' }];
  },

  step(s, act) {
    if (!s.cur) return { ok: false, state: s, message: 'El barrio ya está ordenado.' };
    if (act.kind !== 'left' && act.kind !== 'right') {
      return { ok: false, state: s, error: 'comando-no-valido', message: 'En Quick Sort di "izquierda" (menor o igual al pivote) o "derecha" (mayor).' };
    }
    const x = s.a[s.cur.j], p = s.a[s.cur.hi];
    const izquierda = x <= p;
    if (act.kind === 'left' && !izquierda) {
      return {
        ok: false, state: s, error: 'elegir-pivote',
        message: `Embotellamiento: el edificio ${x} no cabe del lado izquierdo.`,
        why: `${x} > ${p} (el pivote), así que debe quedarse a la derecha de la avenida pivote.`,
      };
    }
    if (act.kind === 'right' && izquierda) {
      return {
        ok: false, state: s, error: 'elegir-pivote',
        message: `Embotellamiento: el edificio ${x} tenía que ir a la izquierda.`,
        why: `${x} ≤ ${p} (el pivote), así que la condición A[j] ≤ pivote es verdadera y va a la izquierda.`,
      };
    }
    const n = clone(s);
    const c = n.cur!;
    n.comps++;
    let message: string;
    if (izquierda) {
      if (c.i !== c.j) {
        [n.a[c.i], n.a[c.j]] = [n.a[c.j], n.a[c.i]];
        n.swaps++;
      }
      c.i++;
      message = `Bien: ${x} ≤ ${p}, pasa al lado izquierdo.`;
    } else {
      message = `Bien: ${x} > ${p}, se queda del lado derecho.`;
    }
    c.j++;
    const notas: string[] = [];
    normalize(n, notas);
    return { ok: true, state: n, message, milestone: notas.join(' ') || undefined };
  },

  line: (s) => (s.done ? 0 : 4),
  focus: (s) => (s.cur ? { indices: [s.cur.j, s.cur.hi] } : {}),

  intro(s) {
    if (!s.cur) return 'El barrio está ordenado.';
    const { j, hi } = s.cur;
    return `Pivote ${s.a[hi]} (A[${hi}]). ¿El edificio A[${j}] = ${s.a[j]} va a la izquierda (menor o igual) o a la derecha (mayor)?`;
  },

  describe(s) {
    if (!s.cur) return `Arreglo [${s.a.join(', ')}] ordenado.`;
    const { lo, hi, i, j } = s.cur;
    return `Arreglo [${s.a.join(', ')}]. Particionando A[${lo}..${hi}] con pivote ${s.a[hi]}; frontera i = ${i}, revisando j = ${j}.`;
  },

  hints(s) {
    if (!s.cur) return ['', '', ''];
    const x = s.a[s.cur.j], p = s.a[s.cur.hi];
    return [
      'Compara el edificio resaltado solo con el pivote (el último del tramo), no con sus vecinos.',
      `¿${x} es menor o igual que el pivote ${p}?`,
      `Ejemplo: con pivote 50, el 30 va a la izquierda y el 80 a la derecha. Aquí ${x} ${x <= p ? '≤' : '>'} ${p}, así que va a la ${x <= p ? 'izquierda' : 'derecha'}.`,
    ];
  },

  final: (s) => `¡Barrio ordenado! [${s.a.join(', ')}] con ${s.comps} comparaciones contra pivotes.`,
};
