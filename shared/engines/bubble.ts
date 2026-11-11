import type { Engine } from './engine';
import { clone } from './engine';

export interface BubbleState {
  a: number[];
  labels: string[] | null;
  i: number; // pasada
  j: number; // comparación dentro de la pasada
  swapped: boolean;
  done: boolean;
  comps: number;
  swaps: number;
}

const nombre = (s: BubbleState, k: number) =>
  s.labels ? `${s.labels[k]} (${s.a[k]})` : `el edificio de ${s.a[k]} pisos`;

export const bubble: Engine<BubbleState> = {
  id: 'bubble',
  nombre: 'Bubble Sort',
  escena: 'Una avenida de edificios: se comparan vecinos y el más alto avanza a la derecha como una burbuja.',
  pseudocodigo: [
    'para i ← 0 hasta n-2',
    '  hubo_cambio ← falso',
    '  para j ← 0 hasta n-2-i',
    '    si A[j] > A[j+1]',
    '      intercambiar(A[j], A[j+1]); hubo_cambio ← verdadero',
    '  si no hubo_cambio: terminar',
    'devolver A',
  ],
  acciones: ['swap', 'skip'],

  init(ex) {
    const a = [...(ex.datos ?? [])];
    return {
      a,
      labels: ex.etiquetas && ex.etiquetas.length === a.length ? [...ex.etiquetas] : null,
      i: 0, j: 0, swapped: false, done: a.length < 2, comps: 0, swaps: 0,
    };
  },

  done: (s) => s.done,

  expected(s) {
    if (s.done) return [];
    return s.a[s.j] > s.a[s.j + 1] ? [{ kind: 'swap' }] : [{ kind: 'skip' }];
  },

  step(s, act) {
    const x = s.a[s.j], y = s.a[s.j + 1];
    if (act.kind !== 'swap' && act.kind !== 'skip') {
      return { ok: false, state: s, error: 'comando-no-valido', message: 'En Bubble Sort solo puedes decir "intercambia" o "avanza".' };
    }
    if (act.kind === 'swap' && act.values) {
      const [p, q] = act.values;
      const coincide = (p === x && q === y) || (p === y && q === x);
      if (!coincide) {
        return {
          ok: false, state: s, error: 'pareja-equivocada',
          message: 'Embotellamiento: esa no es la pareja que se está comparando.',
          why: `Ahora se comparan A[${s.j}] = ${x} y A[${s.j + 1}] = ${y}, no ${p} y ${q}. Bubble Sort solo compara vecinos.`,
        };
      }
    }
    const debe = x > y;
    if (act.kind === 'swap' && !debe) {
      return {
        ok: false, state: s, error: 'decidir-intercambio',
        message: 'Embotellamiento: intercambiaste dos edificios que ya estaban en orden.',
        why: `${x} ≤ ${y}, así que la condición A[j] > A[j+1] es falsa. El más alto ya está a la derecha: había que avanzar.`,
      };
    }
    if (act.kind === 'skip' && debe) {
      return {
        ok: false, state: s, error: 'decidir-intercambio',
        message: 'Embotellamiento: el edificio más alto quedó a la izquierda.',
        why: `${x} > ${y}, así que la condición A[j] > A[j+1] es verdadera: había que intercambiarlos.`,
      };
    }
    const n = clone(s);
    n.comps++;
    let message: string;
    if (debe) {
      [n.a[n.j], n.a[n.j + 1]] = [n.a[n.j + 1], n.a[n.j]];
      if (n.labels) [n.labels[n.j], n.labels[n.j + 1]] = [n.labels[n.j + 1], n.labels[n.j]];
      n.swapped = true;
      n.swaps++;
      message = `Bien: ${x} > ${y}, así que se intercambian y ${nombre(n, n.j + 1)} pasa a la derecha.`;
    } else {
      message = `Bien: ${x} ≤ ${y}, ya están en orden y avanzas.`;
    }
    let milestone: string | undefined;
    n.j++;
    const len = n.a.length;
    if (n.j > len - 2 - n.i) {
      const fijo = len - 1 - n.i;
      if (!n.swapped) {
        n.done = true;
        milestone = 'Pasada sin intercambios: la avenida ya está ordenada.';
      } else {
        milestone = `Fin de la pasada ${n.i + 1}: ${nombre(n, fijo)} ya está en su lugar definitivo.`;
        n.i++;
        n.j = 0;
        n.swapped = false;
        if (n.i >= len - 1) n.done = true;
      }
    }
    return { ok: true, state: n, message, milestone };
  },

  line: (s) => (s.done ? 6 : 3),
  focus: (s) => (s.done ? {} : { indices: [s.j, s.j + 1] }),

  intro(s) {
    if (s.done) return 'La avenida está ordenada.';
    return `Pasada ${s.i + 1}. Compara A[${s.j}] = ${s.a[s.j]} con A[${s.j + 1}] = ${s.a[s.j + 1]}. ¿Intercambias o avanzas?`;
  },

  describe(s) {
    const fijos = s.i > 0 ? ` Los últimos ${s.i} edificios ya están en su lugar.` : '';
    return `Arreglo [${s.a.join(', ')}], pasada ${s.i + 1}, comparando posiciones ${s.j} y ${s.j + 1}.${fijos}`;
  },

  hints(s) {
    const x = s.a[s.j], y = s.a[s.j + 1];
    return [
      'Mira solo los dos edificios resaltados: en Bubble Sort el más alto de la pareja tiene que quedar a la derecha.',
      `¿El edificio de ${x} pisos es más alto que el de ${y}? Si lo es, ¿en qué lado debería estar?`,
      `Ejemplo: con [7, 4], como 7 > 4 se intercambian y queda [4, 7]. Aquí ${x} ${x > y ? '>' : '≤'} ${y}, así que la acción es "${x > y ? 'intercambia' : 'avanza'}".`,
    ];
  },

  final: (s) => `¡Avenida ordenada! [${s.a.join(', ')}] con ${s.comps} comparaciones y ${s.swaps} intercambios.`,
};
