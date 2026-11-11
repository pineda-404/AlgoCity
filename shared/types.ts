/** Tipos compartidos entre la PWA, el servidor y las pruebas. */

export type AlgorithmId = 'bubble' | 'merge' | 'quick' | 'bst' | 'bfs' | 'dijkstra';
export const ALGORITHMS: AlgorithmId[] = ['bubble', 'merge', 'quick', 'bst', 'bfs', 'dijkstra'];

/** Tipos de error que alimentan el perfil adaptativo (RF-13). */
export type ErrorType =
  | 'decidir-intercambio'
  | 'pareja-equivocada'
  | 'elegir-pivote'
  | 'fusionar'
  | 'insertar-bst'
  | 'visitar-nodo'
  | 'comando-no-valido';

export type Mood = 'ganas' | 'normal' | 'cansado' | 'frustrado';
export type Level = 'basico' | 'intermedio' | 'avanzado';

export type GraphEdge = [string, string] | [string, string, number];

export interface GraphData {
  nodos: string[];
  aristas: GraphEdge[];
  /** Posiciones opcionales (0..100) para dibujar el mapa. */
  coords?: Record<string, [number, number]>;
}

export interface Exercise {
  id: string;
  algoritmo: AlgorithmId;
  titulo: string;
  metafora: string;
  nivel: Level;
  datos?: number[];
  etiquetas?: string[];
  inserciones?: number[];
  grafo?: GraphData;
  inicio?: string;
  destino?: string;
  /** Origen del ejercicio: catálogo, variante del LLM, generador local o datos del estudiante. */
  origen?: 'catalogo' | 'llm' | 'generador' | 'propio';
}

/** Acciones que el estudiante puede proponer al motor. */
export type Action =
  | { kind: 'swap'; values?: [number, number] }
  | { kind: 'skip' }
  | { kind: 'left' }
  | { kind: 'right' }
  | { kind: 'visit'; node: string };

export type ActionKind = Action['kind'];
