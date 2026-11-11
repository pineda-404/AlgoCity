import type { Engine } from './engine';
import { clone } from './engine';

export interface MergeState {
  a: number[];
  width: number;
  lo: number;
  mid: number;
  hi: number;
  i: number;
  j: number;
  out: number[];
  done: boolean;
  comps: number;
}

function setup(s: MergeState, lo: number): void {
  let start = lo;
  for (;;) {
    if (s.width >= s.a.length) {
      s.done = true;
      return;
    }
    if (start + s.width >= s.a.length) {
      s.width *= 2;
      start = 0;
      continue;
    }
    s.lo = start;
    s.mid = start + s.width;
    s.hi = Math.min(start + 2 * s.width, s.a.length);
    s.i = s.lo;
    s.j = s.mid;
    s.out = [];
    return;
  }
}

/** Si uno de los dos barrios se vació, copia el resto y pasa al siguiente par. */
function normalize(s: MergeState, notas: string[]): void {
  while (!s.done && (s.i >= s.mid || s.j >= s.hi)) {
    s.out.push(...s.a.slice(s.i, s.mid), ...s.a.slice(s.j, s.hi));
    s.a.splice(s.lo, s.out.length, ...s.out);
    notas.push(`Barrio unido: [${s.out.join(', ')}].`);
    const anchoAntes = s.width;
    setup(s, s.hi);
    if (!s.done && s.width !== anchoAntes) notas.push(`Ahora se fusionan barrios de ${s.width} edificios.`);
  }
}

export const merge: Engine<MergeState> = {
  id: 'merge',
  nombre: 'Merge Sort',
  escena: 'Barrios ya ordenados se fusionan en una nueva avenida: siempre entra primero el edificio más bajo de los dos frentes.',
  pseudocodigo: [
    'para ancho ← 1, 2, 4, … mientras ancho < n',
    '  para cada par de barrios A[lo..mid) y A[mid..hi)',
    '    mientras queden edificios en ambos barrios',
    '      si izq[i] ≤ der[j]: tomar izq[i]',
    '      si no: tomar der[j]',
    '    copiar lo que sobre y unir el barrio',
    'devolver A',
  ],
  acciones: ['left', 'right'],

  init(ex) {
    const a = [...(ex.datos ?? [])];
    const s: MergeState = { a, width: 1, lo: 0, mid: 0, hi: 0, i: 0, j: 0, out: [], done: a.length < 2, comps: 0 };
    if (!s.done) setup(s, 0);
    normalize(s, []);
    return s;
  },

  done: (s) => s.done,

  expected(s) {
    if (s.done) return [];
    const x = s.a[s.i], y = s.a[s.j];
    if (x === y) return [{ kind: 'left' }, { kind: 'right' }];
    return x < y ? [{ kind: 'left' }] : [{ kind: 'right' }];
  },

  step(s, act) {
    if (s.done) return { ok: false, state: s, message: 'La ciudad ya está fusionada.' };
    if (act.kind !== 'left' && act.kind !== 'right') {
      return { ok: false, state: s, error: 'comando-no-valido', message: 'En Merge Sort di "izquierda" o "derecha" para elegir qué edificio entra primero.' };
    }
    const x = s.a[s.i], y = s.a[s.j];
    if (act.kind === 'left' && x > y) {
      return {
        ok: false, state: s, error: 'fusionar',
        message: `Embotellamiento: el ${x} se coló antes que el ${y}.`,
        why: `En la nueva avenida entra primero el menor de los dos frentes: ${y} < ${x}, así que tocaba tomar el de la derecha.`,
      };
    }
    if (act.kind === 'right' && y > x) {
      return {
        ok: false, state: s, error: 'fusionar',
        message: `Embotellamiento: el ${y} se coló antes que el ${x}.`,
        why: `En la nueva avenida entra primero el menor de los dos frentes: ${x} < ${y}, así que tocaba tomar el de la izquierda.`,
      };
    }
    const n = clone(s);
    n.comps++;
    let message: string;
    if (act.kind === 'left') {
      n.out.push(x);
      n.i++;
      message = `Bien: ${x} ≤ ${y}, entra el ${x} del barrio izquierdo.`;
    } else {
      n.out.push(y);
      n.j++;
      message = `Bien: ${y} ≤ ${x}, entra el ${y} del barrio derecho.`;
    }
    const notas: string[] = [];
    normalize(n, notas);
    return { ok: true, state: n, message, milestone: notas.join(' ') || undefined };
  },

  line: (s) => (s.done ? 6 : 3),
  focus: (s) => (s.done ? {} : { indices: [s.i, s.j] }),

  intro(s) {
    if (s.done) return 'La ciudad está fusionada y ordenada.';
    return `Fusionando [${s.a.slice(s.lo, s.mid).join(', ')}] con [${s.a.slice(s.mid, s.hi).join(', ')}]. ¿Qué entra primero: ${s.a[s.i]} (izquierda) o ${s.a[s.j]} (derecha)?`;
  },

  describe(s) {
    if (s.done) return `Arreglo [${s.a.join(', ')}] ordenado.`;
    return `Ancho ${s.width}. Barrio izquierdo [${s.a.slice(s.lo, s.mid).join(', ')}] desde la posición ${s.i}; barrio derecho [${s.a.slice(s.mid, s.hi).join(', ')}] desde la posición ${s.j}; nueva avenida [${s.out.join(', ')}].`;
  },

  hints(s) {
    const x = s.a[s.i], y = s.a[s.j];
    return [
      'Solo importan los dos edificios del frente de cada barrio: los demás ya están ordenados detrás de ellos.',
      `Entre ${x} y ${y}, ¿cuál es más bajo?`,
      `Ejemplo: al fusionar [3, 9] con [5, 7] entra primero 3, luego 5, 7 y 9. Aquí ${Math.min(x, y)} es menor, así que di "${x <= y ? 'izquierda' : 'derecha'}".`,
    ];
  },

  final: (s) => `¡Ciudad fusionada! [${s.a.join(', ')}] con ${s.comps} comparaciones.`,
};
