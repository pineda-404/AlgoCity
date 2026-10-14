/**
 * Capa de abstracción del LLM (RF-10, RF-11, RF-12, RNF-08).
 * Todos los módulos piden texto a través de esta interfaz; el proveedor se elige
 * con la variable de entorno LLM_PROVIDER y, si falla, se usa el siguiente de la cadena.
 */

export type AlgorithmId = 'bubble' | 'merge' | 'quick' | 'bst' | 'bfs' | 'dijkstra';
export type ErrorType = 'decidir-intercambio' | 'pareja-equivocada' | 'elegir-pivote' | 'insertar-bst' | 'fusionar' | 'visitar-nodo';
export type Mood = 'ganas' | 'normal' | 'cansado' | 'frustrado';

export interface StepEvent {
  algorithm: AlgorithmId;
  state: number[];            // estado de la estructura antes del paso
  comparing: [number, number]; // índices comparados
  userAction: 'swap' | 'skip' | 'other';
  correct: boolean;
  pseudocodeLine: number;
}

export interface LearnerProfile {
  level: 'basico' | 'intermedio' | 'avanzado';
  mood: Mood;
  frequentErrors: Partial<Record<ErrorType, number>>;
  calmMode: boolean;
}

export interface LLMProvider {
  readonly name: string;
  narrate(step: StepEvent, profile: LearnerProfile): Promise<string>;
  hint(step: StepEvent, level: 1 | 2 | 3): Promise<string>;
  variant(algorithm: AlgorithmId, weakSpots: ErrorType[]): Promise<number[]>;
}

/** Intenta cada proveedor en orden; si uno no responde a tiempo, pasa al siguiente. */
export class FallbackProvider implements LLMProvider {
  readonly name = 'fallback';
  constructor(private providers: LLMProvider[], private opts = { timeoutMs: 3000 }) {}

  private async first<T>(call: (p: LLMProvider) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const p of this.providers) {
      try {
        return await Promise.race([
          call(p),
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${p.name}: tiempo agotado`)), this.opts.timeoutMs)),
        ]);
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  }

  narrate(step: StepEvent, profile: LearnerProfile) { return this.first(p => p.narrate(step, profile)); }
  hint(step: StepEvent, level: 1 | 2 | 3) { return this.first(p => p.hint(step, level)); }
  variant(algorithm: AlgorithmId, weakSpots: ErrorType[]) { return this.first(p => p.variant(algorithm, weakSpots)); }
}

/** Último eslabón: textos predefinidos, siempre disponible y sin red. */
export class CannedProvider implements LLMProvider {
  readonly name = 'canned';
  async narrate(step: StepEvent) {
    const [i, j] = step.comparing; const a = step.state[i], b = step.state[j];
    if (step.correct) return step.userAction === 'swap' ? `Bien. ${a} es mayor que ${b}, así que se intercambian.` : `Correcto. ${a} ya es menor o igual que ${b}.`;
    return `Ese movimiento bloqueó la avenida. Compara de nuevo ${a} y ${b}.`;
  }
  async hint(step: StepEvent, level: 1 | 2 | 3) {
    const [i, j] = step.comparing;
    return [
      'Solo se intercambia si el edificio de la izquierda es más alto que el de la derecha.',
      `¿El edificio de ${step.state[i]} pisos es más alto que el de ${step.state[j]}?`,
      'Ejemplo: con [7, 4], 7 > 4, así que se intercambian y queda [4, 7].',
    ][level - 1];
  }
  async variant(_algorithm: AlgorithmId, weakSpots: ErrorType[]) {
    // Valores cercanos si el estudiante falla al decidir intercambios
    return weakSpots.includes('decidir-intercambio') ? [6, 5, 7, 4, 5] : [9, 2, 7, 1, 5];
  }
}
