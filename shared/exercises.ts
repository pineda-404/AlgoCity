import catalogo from '../data/mock/ejercicios.json';
import type { AlgorithmId, ErrorType, Exercise, GraphData, GraphEdge, Level } from './types';

export const CATALOGO: Exercise[] = (catalogo as Exercise[]).map((e) => ({ ...e, origen: 'catalogo' }));

export const NOMBRES: Record<AlgorithmId, string> = {
  bubble: 'Bubble Sort',
  merge: 'Merge Sort',
  quick: 'Quick Sort',
  bst: 'Árbol binario de búsqueda',
  bfs: 'BFS',
  dijkstra: 'Dijkstra',
};

export const ERROR_LABEL: Record<ErrorType, string> = {
  'decidir-intercambio': 'Decidir si intercambiar',
  'pareja-equivocada': 'Comparar la pareja equivocada',
  'elegir-pivote': 'Ubicar respecto al pivote',
  fusionar: 'Elegir quién entra al fusionar',
  'insertar-bst': 'Elegir el lado en el árbol',
  'visitar-nodo': 'Elegir la siguiente estación',
  'comando-no-valido': 'Comando no válido',
};

export const ERROR_ALGO: Record<ErrorType, AlgorithmId | null> = {
  'decidir-intercambio': 'bubble',
  'pareja-equivocada': 'bubble',
  'elegir-pivote': 'quick',
  fusionar: 'merge',
  'insertar-bst': 'bst',
  'visitar-nodo': 'dijkstra',
  'comando-no-valido': null,
};

export function exercisesFor(alg: AlgorithmId): Exercise[] {
  return CATALOGO.filter((e) => e.algoritmo === alg);
}

export function findExercise(id: string): Exercise | undefined {
  return CATALOGO.find((e) => e.id === id);
}

// ------------------------------------------------------------ generador local de variantes (RF-12)

/** Generador pseudoaleatorio reproducible (para pruebas y para salas). */
export function rng(seed: number): () => number {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) % 100000) / 100000;
  };
}

const TAM: Record<Level, number> = { basico: 5, intermedio: 7, avanzado: 9 };

/**
 * Crea una variante ajustada al nivel y a los errores del estudiante. Lo usa el servidor
 * cuando el LLM no responde y la PWA cuando no hay conexión.
 */
export function generateVariant(alg: AlgorithmId, nivel: Level, weakSpots: ErrorType[], seed = Date.now()): Exercise {
  const r = rng(seed);
  const n = TAM[nivel];
  const int = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));
  const base: Omit<Exercise, 'algoritmo' | 'titulo' | 'metafora'> = { id: `v-${alg}-${seed}`, nivel, origen: 'generador' };

  if (alg === 'bubble' || alg === 'quick' || alg === 'merge') {
    let datos: number[];
    const cerca = (alg === 'bubble' && weakSpots.includes('decidir-intercambio')) || (alg === 'quick' && weakSpots.includes('elegir-pivote')) || (alg === 'merge' && weakSpots.includes('fusionar'));
    if (cerca) {
      // Valores parecidos y repetidos: obligan a mirar la condición con cuidado.
      const centro = int(4, 8);
      datos = Array.from({ length: n }, () => centro + int(-2, 2));
    } else {
      datos = Array.from({ length: n }, () => int(1, alg === 'bubble' ? 9 : 99));
    }
    const titulo = alg === 'bubble' ? 'Avenida nueva' : alg === 'quick' ? 'Barrio por partir' : 'Barrios por fusionar';
    return { ...base, algoritmo: alg, titulo, metafora: cerca ? 'Edificios de alturas muy parecidas: fíjate bien en cada comparación.' : 'Una avenida generada para ti.', datos };
  }

  if (alg === 'bst') {
    const valores = new Set<number>();
    const raiz = int(40, 60);
    valores.add(raiz);
    const zigzag = weakSpots.includes('insertar-bst');
    while (valores.size < n + 1) {
      valores.add(zigzag ? raiz + (valores.size % 2 ? -1 : 1) * int(1, 25) : int(5, 95));
    }
    return { ...base, algoritmo: 'bst', titulo: 'Avenidas por trazar', metafora: zigzag ? 'Valores que alternan a ambos lados del primer cruce.' : 'Un sistema de avenidas generado para ti.', inserciones: [...valores] };
  }

  // Grafos: una red conexa con algunos empates para practicar la decisión.
  const letras = 'ABCDEFGHIJ'.slice(0, Math.min(n, 8)).split('');
  const aristas: GraphEdge[] = [];
  for (let k = 1; k < letras.length; k++) {
    const u = letras[int(0, k - 1)];
    aristas.push(alg === 'dijkstra' ? [u, letras[k], int(1, 9)] : [u, letras[k]]);
  }
  const extra = Math.floor(letras.length / 2);
  for (let k = 0; k < extra; k++) {
    const u = letras[int(0, letras.length - 1)], v = letras[int(0, letras.length - 1)];
    if (u !== v && !aristas.some(([p, q]) => (p === u && q === v) || (p === v && q === u))) {
      aristas.push(alg === 'dijkstra' ? [u, v, int(1, 9)] : [u, v]);
    }
  }
  const grafo: GraphData = { nodos: letras, aristas, coords: circleLayout(letras) };
  return {
    ...base, algoritmo: alg, grafo, inicio: 'A', destino: letras[letras.length - 1],
    titulo: alg === 'bfs' ? 'Red de metro nueva' : 'Ruta por calcular',
    metafora: alg === 'bfs' ? 'Una red de metro generada para ti.' : 'Tramos con tiempos generados para ti.',
  };
}

export function circleLayout(nodes: string[]): Record<string, [number, number]> {
  const out: Record<string, [number, number]> = {};
  nodes.forEach((n, i) => {
    const ang = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
    out[n] = [50 + 38 * Math.cos(ang), 50 + 38 * Math.sin(ang)];
  });
  return out;
}

// ------------------------------------------------------------ datos propios del estudiante

export interface ParseResult {
  ok: boolean;
  exercise?: Exercise;
  error?: string;
}

/** Convierte lo que escribe el estudiante (su práctica, su tarea) en un ejercicio. */
export function parseCustom(alg: AlgorithmId, texto: string, inicio?: string, destino?: string): ParseResult {
  const id = `propio-${alg}-${Date.now()}`;
  if (alg === 'bubble' || alg === 'merge' || alg === 'quick' || alg === 'bst') {
    const nums = (texto.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);
    if (nums.length < 2) return { ok: false, error: 'Escribe al menos 2 números separados por comas o espacios.' };
    if (nums.length > 12) return { ok: false, error: 'Usa como máximo 12 números para que la ciudad se vea bien.' };
    if (nums.some((x) => Math.abs(x) > 999)) return { ok: false, error: 'Usa números entre -999 y 999.' };
    const ex: Exercise = { id, algoritmo: alg, titulo: 'Tus datos', metafora: 'Ejercicio armado con tus propios datos.', nivel: 'intermedio', origen: 'propio' };
    if (alg === 'bst') ex.inserciones = nums;
    else ex.datos = nums;
    return { ok: true, exercise: ex };
  }
  // Grafo: una arista por línea: "A B 4" o "A - B : 4"
  const aristas: GraphEdge[] = [];
  const nodos: string[] = [];
  const lineas = texto.split(/\n|;/).map((l) => l.trim()).filter(Boolean);
  for (const l of lineas) {
    let u: string, v: string, w: string | undefined;
    if (/[-—]/.test(l)) {
      // Nombres con espacios: "Puerta 3 - Biblioteca : 4"
      const [a, ...resto] = l.split(/\s*[-—]\s*/);
      const m = resto.join(' ').match(/^(.+?)(?:\s*[:=,]\s*|\s+)(\d+(?:\.\d+)?)$/);
      u = a;
      v = m ? m[1] : resto.join(' ');
      w = m ? m[2] : undefined;
    } else {
      const tokens = l.split(/[\s,]+/);
      if (tokens.length < 2 || tokens.length > 3) return { ok: false, error: `No entiendo la línea "${l}". Usa el formato: A B 4 (o "Puerta 3 - Biblioteca : 4" si los nombres tienen espacios).` };
      [u, v, w] = tokens;
    }
    if (!u || !v) return { ok: false, error: `No entiendo la línea "${l}". Usa el formato: A B 4` };
    if (w !== undefined && !/^\d+(\.\d+)?$/.test(w)) return { ok: false, error: `El tiempo del tramo "${l}" debe ser un número.` };
    if (alg === 'dijkstra' && !w) return { ok: false, error: `Falta el tiempo del tramo en "${l}". Ejemplo: A B 4` };
    if (w && Number(w) < 0) return { ok: false, error: 'Dijkstra no admite tramos negativos.' };
    for (const x of [u.trim(), v.trim()]) if (!nodos.includes(x)) nodos.push(x);
    aristas.push(w ? [u.trim(), v.trim(), Number(w)] : [u.trim(), v.trim()]);
  }
  if (nodos.length < 2) return { ok: false, error: 'Escribe al menos un tramo, por ejemplo: A B 4' };
  if (nodos.length > 10) return { ok: false, error: 'Usa como máximo 10 estaciones.' };
  const ini = inicio && nodos.includes(inicio.trim()) ? inicio.trim() : nodos[0];
  const fin = destino && nodos.includes(destino.trim()) ? destino.trim() : undefined;
  return {
    ok: true,
    exercise: {
      id, algoritmo: alg, titulo: 'Tu red', metafora: 'Red armada con tus propios datos.', nivel: 'intermedio', origen: 'propio',
      grafo: { nodos, aristas, coords: circleLayout(nodos) }, inicio: ini, destino: fin,
    },
  };
}

/** Valida una variante que propone el LLM antes de usarla (nunca se confía a ciegas). */
export function validateExercise(ex: Partial<Exercise>, alg: AlgorithmId): ex is Exercise {
  if (!ex || ex.algoritmo !== alg) return false;
  if (alg === 'bst') return Array.isArray(ex.inserciones) && ex.inserciones.length >= 3 && ex.inserciones.length <= 12 && ex.inserciones.every(Number.isFinite);
  if (alg === 'bfs' || alg === 'dijkstra') {
    const g = ex.grafo;
    if (!g || !Array.isArray(g.nodos) || !Array.isArray(g.aristas) || g.nodos.length < 3 || g.nodos.length > 10) return false;
    return g.aristas.every((a) => Array.isArray(a) && g.nodos.includes(a[0]) && g.nodos.includes(a[1]) && (alg === 'bfs' || (typeof a[2] === 'number' && a[2] >= 0)));
  }
  return Array.isArray(ex.datos) && ex.datos.length >= 3 && ex.datos.length <= 12 && ex.datos.every(Number.isFinite);
}
