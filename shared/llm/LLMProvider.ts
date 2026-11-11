/**
 * Capa de abstracción del LLM (RF-10, RF-11, RF-12, RNF-08).
 * Todos los módulos piden texto a través de esta interfaz; el proveedor se elige
 * con la variable de entorno LLM_PROVIDER y, si falla o tarda más de 3 s, se usa
 * el siguiente de la cadena (remoto → local → textos predefinidos).
 *
 * El motor de algoritmos es la fuente de verdad: el LLM recibe los hechos del paso
 * (estado, condición incumplida, pistas base) y solo los explica con el tono adecuado.
 */
import type { AlgorithmId, ErrorType, Exercise, Level, Mood } from '../types';
import { generateVariant, validateExercise } from '../exercises';
import { buildPrompt, SYSTEM_PROMPT, type PromptKind } from './prompts';

export type { AlgorithmId, ErrorType, Mood };

export interface StepEvent {
  algorithm: AlgorithmId;
  exerciseTitle: string;
  /** Estado actual en texto (engine.describe). */
  context: string;
  /** Qué debe decidir el estudiante (engine.intro). */
  question: string;
  /** Lo que hizo o dijo el estudiante. */
  userAction: string;
  correct: boolean;
  error?: ErrorType;
  /** Condición incumplida calculada por el motor (RF-08). */
  why?: string;
  /** Pistas deterministas del motor: orientación, pregunta guiada, ejemplo. */
  hints: [string, string, string];
  pseudocode: string[];
  line: number;
}

export interface LearnerProfile {
  name?: string;
  level: Level;
  mood: Mood;
  frequentErrors: Partial<Record<ErrorType, number>>;
  calmMode: boolean;
}

export interface VariantRequest {
  algorithm: AlgorithmId;
  level: Level;
  weakSpots: ErrorType[];
}

export interface SessionRecap {
  algorithm: AlgorithmId;
  exerciseTitle: string;
  steps: number;
  errors: number;
  hints: number;
  undos: number;
  seconds: number;
  errorTypes: Partial<Record<ErrorType, number>>;
  completed: boolean;
}

export interface LLMProvider {
  readonly name: string;
  /** Explica un error (o felicita un acierto) con el tono del perfil. */
  narrate(step: StepEvent, profile: LearnerProfile): Promise<string>;
  /** Pista de nivel 1 (orientación), 2 (pregunta guiada) o 3 (ejemplo resuelto). */
  hint(step: StepEvent, level: 1 | 2 | 3, profile?: LearnerProfile): Promise<string>;
  /** Nuevo ejercicio ajustado al nivel y a los errores del estudiante (RF-12). */
  variant(req: VariantRequest): Promise<Exercise>;
  /** Pregunta libre del estudiante sobre el paso actual. */
  ask(question: string, step: StepEvent | null, profile: LearnerProfile): Promise<string>;
  /** Comentario de cierre y pregunta de reflexión (RF-18). */
  reflect(recap: SessionRecap, profile: LearnerProfile): Promise<string>;
}

/** Intenta cada proveedor en orden; si uno no responde a tiempo, pasa al siguiente. */
export class FallbackProvider implements LLMProvider {
  readonly name = 'fallback';
  /** Nombre del último proveedor que respondió (para mostrarlo en la interfaz). */
  lastUsed = '';
  constructor(private providers: LLMProvider[], private opts = { timeoutMs: 3000 }) {}

  private async first<T>(call: (p: LLMProvider) => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (const p of this.providers) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const r = await Promise.race([
          call(p),
          new Promise<T>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`${p.name}: tiempo agotado`)), this.opts.timeoutMs);
          }),
        ]);
        this.lastUsed = p.name;
        return r;
      } catch (err) {
        lastError = err;
      } finally {
        if (timer) clearTimeout(timer);
      }
    }
    throw lastError;
  }

  narrate(step: StepEvent, profile: LearnerProfile) { return this.first((p) => p.narrate(step, profile)); }
  hint(step: StepEvent, level: 1 | 2 | 3, profile?: LearnerProfile) { return this.first((p) => p.hint(step, level, profile)); }
  variant(req: VariantRequest) { return this.first((p) => p.variant(req)); }
  ask(question: string, step: StepEvent | null, profile: LearnerProfile) { return this.first((p) => p.ask(question, step, profile)); }
  reflect(recap: SessionRecap, profile: LearnerProfile) { return this.first((p) => p.reflect(recap, profile)); }
}

/** Proveedores que solo saben completar texto: los prompts se arman aquí, igual para todos. */
export abstract class PromptedProvider implements LLMProvider {
  abstract readonly name: string;
  protected abstract complete(system: string, user: string, json?: boolean): Promise<string>;

  private run(kind: PromptKind, data: Record<string, unknown>, json = false) {
    return this.complete(SYSTEM_PROMPT, buildPrompt(kind, data), json).then((t) => t.trim());
  }

  async narrate(step: StepEvent, profile: LearnerProfile) {
    return clean(await this.run('narrate', { step, profile }));
  }
  async hint(step: StepEvent, level: 1 | 2 | 3, profile?: LearnerProfile) {
    return clean(await this.run('hint', { step, level, profile }));
  }
  async ask(question: string, step: StepEvent | null, profile: LearnerProfile) {
    return clean(await this.run('ask', { question, step, profile }));
  }
  async reflect(recap: SessionRecap, profile: LearnerProfile) {
    return clean(await this.run('reflect', { recap, profile }));
  }
  async variant(req: VariantRequest): Promise<Exercise> {
    const raw = await this.run('variant', { req }, true);
    const json = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1);
    const ex = { ...JSON.parse(json), algoritmo: req.algorithm, nivel: req.level, id: `llm-${req.algorithm}-${Date.now()}`, origen: 'llm' } as Exercise;
    if (!ex.titulo) ex.titulo = 'Variante del Arquitecto Jefe';
    if (!ex.metafora) ex.metafora = 'Ejercicio creado para ti.';
    if (!validateExercise(ex, req.algorithm)) throw new Error(`${this.name}: variante inválida`);
    return ex;
  }
}

const clean = (t: string) => t.replace(/^["“]|["”]$/g, '').replace(/\*\*/g, '').trim();

/**
 * Cliente para cualquier API compatible con OpenAI Chat Completions:
 * OpenAI, Groq, Gemini (endpoint OpenAI), OpenRouter, LM Studio u Ollama (/v1).
 */
export class OpenAICompatibleProvider extends PromptedProvider {
  constructor(
    readonly name: string,
    private cfg: { baseUrl: string; apiKey?: string; model: string; temperature?: number },
  ) {
    super();
  }

  protected async complete(system: string, user: string, json = false): Promise<string> {
    const res = await fetch(`${this.cfg.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(this.cfg.apiKey ? { Authorization: `Bearer ${this.cfg.apiKey}` } : {}) },
      body: JSON.stringify({
        model: this.cfg.model,
        temperature: this.cfg.temperature ?? 0.4,
        max_tokens: json ? 400 : 220,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) throw new Error(`${this.name}: HTTP ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${this.name}: respuesta vacía`);
    return text;
  }
}

/** Último eslabón: textos predefinidos, siempre disponible y sin red (RF-22). */
export class CannedProvider implements LLMProvider {
  readonly name = 'canned';

  async narrate(step: StepEvent, profile: LearnerProfile) {
    if (step.correct) return profile.mood === 'ganas' ? '¡Excelente ritmo, sigue así!' : 'Bien hecho.';
    const apoyo = profile.calmMode || profile.mood === 'frustrado'
      ? 'Tranquilo, equivocarse es parte de construir la ciudad. '
      : '';
    return `${apoyo}${step.why ?? 'Ese paso no cumple la condición del algoritmo.'} Si quieres, di "retrocede el tiempo" o "dame una pista".`;
  }

  async hint(step: StepEvent, level: 1 | 2 | 3) {
    return step.hints[level - 1] || 'Observa los elementos resaltados en la ciudad.';
  }

  async variant(req: VariantRequest) {
    return generateVariant(req.algorithm, req.level, req.weakSpots);
  }

  async ask(question: string, step: StepEvent | null) {
    const q = question.toLowerCase();
    if (!step) return 'Ahora mismo respondo sin conexión al modelo de lenguaje. Elige un algoritmo en el catálogo y te guío paso a paso.';
    if (/por ?qu[eé]/.test(q) && step.why) return `${step.why}`;
    if (/pivote/.test(q)) return 'El pivote es el valor de referencia: los menores o iguales quedan a su izquierda y los mayores a su derecha. Aquí el pivote es el último edificio del tramo.';
    if (/frente|fusion|merge/.test(q)) return 'Cada barrio ya está ordenado, así que su edificio del frente es el más bajo de ese barrio. Por eso el más bajo de todos los que faltan tiene que ser uno de los dos frentes: basta compararlos.';
    if (/cola/.test(q)) return 'En BFS la cola guarda las estaciones descubiertas en el orden en que se descubrieron; siempre se visita primero la que llegó antes.';
    if (/complejidad|big ?o|eficien/.test(q)) {
      return {
        bubble: 'Bubble Sort hace O(n²) comparaciones en el peor caso y O(n) si ya está ordenado (gracias a la parada temprana).',
        merge: 'Merge Sort siempre hace O(n log n) comparaciones, pero usa memoria extra O(n) para la nueva avenida.',
        quick: 'Quick Sort hace O(n log n) en promedio y O(n²) en el peor caso, cuando el pivote siempre queda en un extremo.',
        bst: 'Insertar en un BST cuesta O(altura): O(log n) si está balanceado y O(n) si crece como una sola avenida.',
        bfs: 'BFS cuesta O(V + E): visita cada estación y revisa cada tramo una vez.',
        dijkstra: 'Dijkstra con cola de prioridad cuesta O((V + E) log V). No funciona con tramos de duración negativa.',
      }[step.algorithm];
    }
    return `Sin un modelo de lenguaje conectado no puedo responder preguntas libres, pero te cuento lo que sé del paso: ${step.question} ${step.hints[0]}`;
  }

  async reflect(recap: SessionRecap) {
    const pregunta: Record<AlgorithmId, string> = {
      bubble: '¿Por qué después de la primera pasada el edificio más alto ya está al final?',
      merge: '¿Por qué basta con mirar el frente de cada barrio al fusionar?',
      quick: '¿Qué pasaría si el pivote fuera siempre el edificio más alto del tramo?',
      bst: '¿Cómo quedaría el árbol si insertaras los valores ya ordenados?',
      bfs: '¿Por qué BFS encuentra el camino con menos tramos, pero no necesariamente el más rápido?',
      dijkstra: '¿Por qué una vez fijada una estación su tiempo ya no puede mejorar?',
    };
    const balance = recap.errors === 0 ? 'Sin embotellamientos: tráfico perfecto.' : `Tuviste ${recap.errors} embotellamiento${recap.errors === 1 ? '' : 's'} y los resolviste.`;
    return `${balance} Para pensar: ${pregunta[recap.algorithm]}`;
  }
}
