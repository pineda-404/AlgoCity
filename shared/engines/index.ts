import type { AlgorithmId } from '../types';
import type { Engine } from './engine';
import { bubble } from './bubble';
import { quick } from './quick';
import { merge } from './merge';
import { bst } from './bst';
import { bfs, dijkstra } from './graph';

export * from './engine';
export type { BubbleState } from './bubble';
export type { QuickState } from './quick';
export type { MergeState } from './merge';
export type { BstState, BstNode } from './bst';
export type { GraphState } from './graph';
export { matchNode, pathTo } from './graph';
export { bstHeight } from './bst';

/**
 * Registro de motores. Agregar un algoritmo nuevo = crear un archivo que implemente
 * Engine y registrarlo aquí (RNF-10, HU-23).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const ENGINES: Record<AlgorithmId, Engine<any>> = { bubble, merge, quick, bst, bfs, dijkstra };

export function getEngine(id: AlgorithmId): Engine<unknown> {
  return ENGINES[id] as Engine<unknown>;
}
