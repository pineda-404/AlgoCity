import { describe, expect, it } from 'vitest';
import { inferMood, newProfile, recommend, recordSession, examGrade, type SessionSummary } from '../shared/profile';
import { CannedProvider, FallbackProvider, type LLMProvider } from '../shared/llm/LLMProvider';

const sesion = (o: Partial<SessionSummary>): SessionSummary => ({
  id: 's', fecha: '2026-11-10T10:00:00Z', algoritmo: 'bubble', ejercicio: 'e01', titulo: 'x', pasos: 10, errores: 0, pistas: 0,
  retrocesos: 0, duracionSeg: 60, completado: true, examen: false, nota: null, animoInicio: 'normal', animoFin: null, erroresPorTipo: {}, ...o,
});

describe('perfil adaptativo (RF-13, RF-14, RF-15)', () => {
  it('dos errores seguidos infieren frustración', () => {
    expect(inferMood([{ ok: true, pausa: 3 }, { ok: false, pausa: 3 }, { ok: false, pausa: 2 }], 5).mood).toBe('frustrado');
  });
  it('una pausa larga infiere cansancio', () => {
    expect(inferMood([{ ok: true, pausa: 90 }], 5).mood).toBe('cansado');
  });
  it('recomienda practicar el error más frecuente', () => {
    let p = newProfile('Ana');
    p = recordSession(p, sesion({ errores: 3, erroresPorTipo: { 'elegir-pivote': 3 }, algoritmo: 'quick' })).profile;
    const r = recommend(p);
    expect(r.algoritmo).toBe('quick');
    expect(r.enfoque).toBe('elegir-pivote');
  });
  it('sin errores recomienda el siguiente algoritmo del recorrido', () => {
    const p = recordSession(newProfile('Ana'), sesion({})).profile;
    expect(recommend(p).algoritmo).toBe('merge');
  });
  it('otorga insignias una sola vez', () => {
    const r1 = recordSession(newProfile('Ana'), sesion({}));
    expect(r1.nuevas).toContain('primera-ciudad');
    expect(r1.nuevas).toContain('sin-embotellamientos');
    const r2 = recordSession(r1.profile, sesion({}));
    expect(r2.nuevas).not.toContain('primera-ciudad');
  });
  it('nota vigesimal del modo examen', () => {
    expect(examGrade(10, 0, 0)).toBe(20);
    expect(examGrade(10, 10, 0)).toBe(10);
  });
});

describe('capa LLM con respaldo (RF-11, RNF-08)', () => {
  const lento: LLMProvider = {
    name: 'lento',
    narrate: () => new Promise((r) => setTimeout(() => r('tarde'), 500)),
    hint: () => Promise.reject(new Error('caído')),
    variant: () => Promise.reject(new Error('caído')),
    ask: () => Promise.reject(new Error('caído')),
    reflect: () => Promise.reject(new Error('caído')),
  };
  const step = {
    algorithm: 'bubble' as const, exerciseTitle: 't', context: '', question: '', userAction: 'swap', correct: false,
    why: '5 ≤ 8', hints: ['h1', 'h2', 'h3'] as [string, string, string], pseudocode: [], line: 3,
  };
  const perfil = { level: 'basico' as const, mood: 'normal' as const, frequentErrors: {}, calmMode: false };
  it('si el proveedor tarda, usa el siguiente', async () => {
    const f = new FallbackProvider([lento, new CannedProvider()], { timeoutMs: 100 });
    expect(await f.narrate(step, perfil)).toContain('5 ≤ 8');
    expect(f.lastUsed).toBe('canned');
  });
  it('las pistas canned respetan el nivel', async () => {
    expect(await new CannedProvider().hint(step, 2)).toBe('h2');
  });
});
