import type { BstState, BubbleState, GraphState, MergeState, QuickState } from '@shared/engines';
import { ENGINES } from '@shared/engines';
import type { Exercise } from '@shared/types';
import { Buildings, type Zone } from './Buildings';
import { Tree } from './Tree';
import { Metro } from './Metro';

/** Traduce el estado de cada motor a su escena urbana (RF-06, RF-07). */
export function Scene({ ex, state, jam, jamNode, onVisit }: { ex: Exercise; state: unknown; jam: boolean; jamNode?: string | null; onVisit?: (n: string) => void }) {
  const eng = ENGINES[ex.algoritmo];
  const done = eng.done(state);
  const aria = `${eng.nombre}. ${eng.describe(state)}`;

  switch (ex.algoritmo) {
    case 'bubble': {
      const s = state as BubbleState;
      const n = s.a.length;
      return <Buildings values={s.a} labels={s.labels} focus={done ? [] : [s.j, s.j + 1]} lit={s.a.map((_, k) => done || k >= n - s.i)} jam={jam} done={done} ariaLabel={aria} />;
    }
    case 'quick': {
      const s = state as QuickState;
      const c = s.cur;
      const zones: Zone[] = c
        ? [
            { from: c.lo, to: c.i, tipo: 'izq', label: c.i > c.lo ? '≤ pivote' : undefined },
            { from: c.i, to: c.j, tipo: 'der', label: c.j > c.i ? '> pivote' : undefined },
          ]
        : [];
      return (
        <Buildings values={s.a} focus={c ? [c.j] : []} lit={s.fijo} pivot={c?.hi}
          dim={s.a.map((_, k) => !!c && (k < c.lo || k > c.hi))} zones={zones} divider={c ? c.i : undefined}
          jam={jam} done={done} ariaLabel={aria} />
      );
    }
    case 'merge': {
      const s = state as MergeState;
      const zones: Zone[] = done ? [] : [
        { from: s.lo, to: s.mid, tipo: 'izq', label: 'Barrio izquierdo' },
        { from: s.mid, to: s.hi, tipo: 'der', label: 'Barrio derecho' },
      ];
      const tomado = (k: number) => !done && ((k >= s.lo && k < s.i) || (k >= s.mid && k < s.j));
      return (
        <Buildings values={s.a} focus={done ? [] : [s.i, s.j]} lit={s.a.map(() => done)} dim={s.a.map((_, k) => tomado(k))}
          zones={zones} out={done ? undefined : s.out} jam={jam} done={done} ariaLabel={aria} />
      );
    }
    case 'bst':
      return <Tree s={state as BstState} jam={jam} done={done} ariaLabel={aria} />;
    case 'bfs':
    case 'dijkstra': {
      const s = state as GraphState;
      const f = eng.focus(state).nodes ?? [];
      return <Metro s={s} algoritmo={ex.algoritmo} coords={ex.grafo?.coords} jamNode={jam ? (jamNode ?? f[0] ?? null) : null} focus={f} done={done} onVisit={onVisit} ariaLabel={aria} />;
    }
  }
}
