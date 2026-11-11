import { describe, expect, it } from 'vitest';
import { ENGINES, solve, pathTo, type GraphState, type BstState } from '../shared/engines';
import { CATALOGO, generateVariant, parseCustom } from '../shared/exercises';
import { ALGORITHMS, type Exercise } from '../shared/types';

const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('motores: cada ejercicio del catálogo se resuelve siguiendo las acciones esperadas', () => {
  for (const ex of CATALOGO) {
    it(`${ex.id} (${ex.algoritmo})`, () => {
      const eng = ENGINES[ex.algoritmo];
      const s0 = eng.init(ex);
      const acciones = solve(eng, s0);
      let s = s0;
      for (const a of acciones) s = eng.step(s, a).state;
      expect(eng.done(s)).toBe(true);
      if (['bubble', 'merge', 'quick'].includes(ex.algoritmo)) expect((s as { a: number[] }).a).toEqual(sorted(ex.datos!));
    });
  }
});

describe('variantes generadas y datos aleatorios', () => {
  for (const alg of ALGORITHMS) {
    it(`${alg}: 30 variantes se resuelven`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const ex = generateVariant(alg, seed % 3 === 0 ? 'avanzado' : 'basico', seed % 2 ? ['decidir-intercambio', 'elegir-pivote', 'fusionar', 'insertar-bst'] : [], seed);
        const eng = ENGINES[alg];
        let s = eng.init(ex);
        for (const a of solve(eng, s)) s = eng.step(s, a).state;
        expect(eng.done(s)).toBe(true);
        if (ex.datos) expect((s as { a: number[] }).a).toEqual(sorted(ex.datos));
      }
    });
  }
});

describe('validación de pasos (RF-08)', () => {
  const ex = CATALOGO.find((e) => e.id === 'e01')!;
  it('bubble: avanzar cuando 5 < 8 es correcto, intercambiar es error', () => {
    const s = ENGINES.bubble.init(ex);
    const mal = ENGINES.bubble.step(s, { kind: 'swap' });
    expect(mal.ok).toBe(false);
    expect(mal.error).toBe('decidir-intercambio');
    expect(mal.why).toContain('5 ≤ 8');
    expect(mal.state).toBe(s);
    expect(ENGINES.bubble.step(s, { kind: 'skip' }).ok).toBe(true);
  });
  it('bubble: nombrar una pareja que no se compara es "pareja-equivocada"', () => {
    const s = ENGINES.bubble.init(ex);
    const r = ENGINES.bubble.step(s, { kind: 'swap', values: [3, 6] });
    expect(r.error).toBe('pareja-equivocada');
  });
  it('bubble: la parada temprana termina si una pasada no tiene intercambios', () => {
    const e: Exercise = { id: 't', algoritmo: 'bubble', titulo: '', metafora: '', nivel: 'basico', datos: [1, 2, 3, 4] };
    const s = ENGINES.bubble.init(e);
    expect(solve(ENGINES.bubble, s)).toHaveLength(3);
  });
  it('quick: 80 frente al pivote 70 va a la derecha', () => {
    const e = CATALOGO.find((x) => x.id === 'e04')!;
    let s = ENGINES.quick.init(e);
    s = ENGINES.quick.step(s, { kind: 'left' }).state; // 10 ≤ 70
    const r = ENGINES.quick.step(s, { kind: 'left' });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('elegir-pivote');
  });
  it('merge: con empate se aceptan ambos lados', () => {
    const e: Exercise = { id: 't', algoritmo: 'merge', titulo: '', metafora: '', nivel: 'basico', datos: [5, 5] };
    const s = ENGINES.merge.init(e);
    expect(ENGINES.merge.expected(s)).toHaveLength(2);
  });
  it('bst: 30 < 50 gira a la izquierda y se construye', () => {
    const e = CATALOGO.find((x) => x.id === 'e05')!;
    const s = ENGINES.bst.init(e) as BstState;
    expect(ENGINES.bst.step(s, { kind: 'right' }).error).toBe('insertar-bst');
    const r = ENGINES.bst.step(s, { kind: 'left' });
    expect((r.state as BstState).nodes).toHaveLength(2);
  });
  it('bfs: no se puede saltar al siguiente nivel', () => {
    const e = CATALOGO.find((x) => x.id === 'e12')!;
    let s = ENGINES.bfs.init(e) as GraphState;
    s = ENGINES.bfs.step(s, { kind: 'visit', node: 'A' }).state;
    expect(ENGINES.bfs.step(s, { kind: 'visit', node: 'D' }).error).toBe('visitar-nodo');
    expect(ENGINES.bfs.step(s, { kind: 'visit', node: 'C' }).ok).toBe(true);
  });
  it('dijkstra: ruta del campus Puerta 3 → CTIC es la más corta', () => {
    const e = CATALOGO.find((x) => x.id === 'e07')!;
    let s = ENGINES.dijkstra.init(e) as GraphState;
    for (const a of solve(ENGINES.dijkstra, s)) s = ENGINES.dijkstra.step(s, a).state;
    expect(s.dist['CTIC']).toBe(10);
    expect(pathTo(s, 'CTIC')).toEqual(['Puerta 3', 'Pab. Central', 'Pab. R (FC)', 'CTIC']);
  });
  it('dijkstra: fijar una estación que no es la más cercana es error', () => {
    const e = CATALOGO.find((x) => x.id === 'e13')!;
    let s = ENGINES.dijkstra.init(e) as GraphState;
    s = ENGINES.dijkstra.step(s, { kind: 'visit', node: 'A' }).state;
    const r = ENGINES.dijkstra.step(s, { kind: 'visit', node: 'B' });
    expect(r.ok).toBe(false);
    expect(r.why).toContain('C');
  });
});

describe('datos propios del estudiante', () => {
  it('arreglo con comas o espacios', () => {
    expect(parseCustom('bubble', '9, 3 7;1').exercise?.datos).toEqual([9, 3, 7, 1]);
  });
  it('grafo con nombres con espacios', () => {
    const r = parseCustom('dijkstra', 'Puerta 3 - Biblioteca : 4\nBiblioteca - CTIC 8', 'Puerta 3', 'CTIC');
    expect(r.ok).toBe(true);
    expect(r.exercise?.grafo?.aristas).toEqual([['Puerta 3', 'Biblioteca', 4], ['Biblioteca', 'CTIC', 8]]);
  });
  it('dijkstra exige tiempos', () => {
    expect(parseCustom('dijkstra', 'A B').ok).toBe(false);
  });
});
