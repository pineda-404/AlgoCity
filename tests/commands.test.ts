import { describe, expect, it } from 'vitest';
import { parseCommand } from '../shared/commands';

const burbuja = { acciones: ['swap', 'skip'] as const };
const grafo = { acciones: ['visit'] as const, nodes: ['Puerta 3', 'Pab. Central', 'Biblioteca', 'Pab. R (FC)', 'CTIC'] };
const lados = { acciones: ['left', 'right'] as const };

describe('intérprete de comandos (RF-03)', () => {
  it.each([
    ['Intercambia', { type: 'action', action: { kind: 'swap' } }],
    ['intercambia el 8 con el 5', { type: 'action', action: { kind: 'swap', values: [8, 5] } }],
    ['intercambia el ocho con el cinco', { type: 'action', action: { kind: 'swap', values: [8, 5] } }],
    ['Avanza sin intercambiar', { type: 'action', action: { kind: 'skip' } }],
    ['no intercambies', { type: 'action', action: { kind: 'skip' } }],
    ['Retrocede el tiempo', { type: 'undo', steps: 1 }],
    ['retrocede 3 pasos', { type: 'undo', steps: 3 }],
    ['Dame una pista', { type: 'hint' }],
    ['¿Qué puedo decir?', { type: 'help' }],
    ['más lento', { type: 'slower' }],
    ['estoy frustrado', { type: 'mood', mood: 'frustrado' }],
    ['no entiendo nada', { type: 'mood', mood: 'frustrado' }],
  ])('"%s"', (txt, esperado) => {
    expect(parseCommand(txt, { acciones: [...burbuja.acciones] })).toEqual(esperado);
  });

  it('visita una estación por nombre aproximado', () => {
    expect(parseCommand('visita la biblioteca', { ...grafo, acciones: [...grafo.acciones] })).toEqual({ type: 'action', action: { kind: 'visit', node: 'Biblioteca' } });
    expect(parseCommand('ve al pabellón central', { ...grafo, acciones: [...grafo.acciones] })).toEqual({ type: 'action', action: { kind: 'visit', node: 'Pab. Central' } });
    expect(parseCommand('ctic', { ...grafo, acciones: [...grafo.acciones] })).toEqual({ type: 'action', action: { kind: 'visit', node: 'CTIC' } });
  });

  it('izquierda / derecha / menor / mayor', () => {
    expect(parseCommand('a la izquierda', { acciones: [...lados.acciones] })).toEqual({ type: 'action', action: { kind: 'left' } });
    expect(parseCommand('es mayor', { acciones: [...lados.acciones] })).toEqual({ type: 'action', action: { kind: 'right' } });
  });

  it('las preguntas van al LLM y las frases sueltas son no válidas', () => {
    expect(parseCommand('¿por qué tengo que intercambiar?', { acciones: [...burbuja.acciones] }).type).toBe('ask');
    expect(parseCommand('hola', { acciones: [...burbuja.acciones] }).type).toBe('unknown');
  });
});

describe('estaciones con nombres de una letra', () => {
  const ctx = { acciones: ['visit' as const], nodes: ['A', 'B', 'C'] };
  it('"visita a" y "ve a la b"', () => {
    expect(parseCommand('visita a', ctx)).toEqual({ type: 'action', action: { kind: 'visit', node: 'A' } });
    expect(parseCommand('ve a la b', ctx)).toEqual({ type: 'action', action: { kind: 'visit', node: 'B' } });
  });
  it('una frase cualquiera no se confunde con la estación A', () => {
    expect(parseCommand('hola', ctx).type).toBe('unknown');
  });
});
