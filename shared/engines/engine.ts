import type { Action, ActionKind, AlgorithmId, ErrorType, Exercise } from '../types';

/**
 * Motor determinista de un algoritmo (decisión de arquitectura C4: el motor valida
 * cada paso y el LLM solo narra y da pistas, así nunca "inventa" un paso incorrecto).
 *
 * El estado es un objeto JSON plano: se puede clonar para "retroceder el tiempo"
 * (RF-09) y enviar por Socket.IO en las salas cooperativas (RF-17).
 */
export interface StepResult<S> {
  ok: boolean;
  /** Estado siguiente si la acción fue correcta; el mismo estado si no. */
  state: S;
  /** Narración determinista del paso (respuesta inmediata, RNF-03). */
  message: string;
  error?: ErrorType;
  /** Condición del algoritmo que no se cumplió (RF-08). */
  why?: string;
  /** Eventos especiales para la escena (p. ej. fin de una pasada). */
  milestone?: string;
}

/** Elementos resaltados en la escena y nombrados en la narración. */
export interface Focus {
  indices?: number[];
  nodes?: string[];
}

export interface Engine<S> {
  id: AlgorithmId;
  nombre: string;
  /** Metáfora urbana del algoritmo (RF-06). */
  escena: string;
  pseudocodigo: string[];
  /** Acciones válidas en este algoritmo (para botones, atajos y ayuda contextual). */
  acciones: ActionKind[];
  init(ex: Exercise): S;
  done(s: S): boolean;
  /** Acciones correctas en el estado actual (puede haber empates). */
  expected(s: S): Action[];
  step(s: S, a: Action): StepResult<S>;
  /** Línea del pseudocódigo resaltada (RF-07). */
  line(s: S): number;
  focus(s: S): Focus;
  /** Qué debe decidir el estudiante ahora. */
  intro(s: S): string;
  /** Estado en texto: para lector de pantalla y como contexto del LLM. */
  describe(s: S): string;
  /** Pistas graduales: orientación, pregunta guiada, ejemplo resuelto (RF-10). */
  hints(s: S): [string, string, string];
  final(s: S): string;
}

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export function sameAction(a: Action, b: Action): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'visit' && b.kind === 'visit') return norm(a.node) === norm(b.node);
  return true;
}

export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resuelve el ejercicio desde un estado siguiendo siempre la primera acción correcta. */
export function solve<S>(engine: Engine<S>, start: S, limit = 2000): Action[] {
  const actions: Action[] = [];
  let s = start;
  while (!engine.done(s) && actions.length < limit) {
    const a = engine.expected(s)[0];
    if (!a) break;
    const r = engine.step(s, a);
    if (!r.ok) throw new Error(`El motor ${engine.id} rechazó su propia acción esperada`);
    actions.push(a);
    s = r.state;
  }
  return actions;
}

export function remainingSteps<S>(engine: Engine<S>, s: S): number {
  return solve(engine, s).length;
}

export function describeAction(a: Action): string {
  switch (a.kind) {
    case 'swap': return 'intercambia';
    case 'skip': return 'avanza';
    case 'left': return 'izquierda';
    case 'right': return 'derecha';
    case 'visit': return `visita ${a.node}`;
  }
}
