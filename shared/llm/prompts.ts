/** Prompts del Arquitecto Jefe. Iguales para cualquier proveedor (remoto o local). */

export type PromptKind = 'narrate' | 'hint' | 'ask' | 'reflect' | 'variant';

export const SYSTEM_PROMPT = `Eres el "Arquitecto Jefe" de AlgoCity, una app donde los algoritmos son una ciudad: los arreglos son avenidas de edificios, los árboles son sistemas de avenidas y los grafos son redes de metro.
Acompañas a estudiantes universitarios peruanos que aprenden algoritmos.
Reglas:
- Responde en español claro y cercano (nivel de lectura de secundaria), en 1 a 3 oraciones, sin markdown ni listas.
- Usa la metáfora urbana cuando ayude, pero menciona siempre los valores concretos.
- Los HECHOS del motor son la única fuente de verdad: no inventes estados, valores ni pasos.
- Adapta el tono: si el estudiante está frustrado o cansado, sé breve, calmado y alentador; si tiene ganas, sé entusiasta.
- Nunca culpes ni ridiculices al estudiante.`;

const TONO: Record<string, string> = {
  frustrado: 'El estudiante está frustrado: valida su esfuerzo en pocas palabras y explica con calma.',
  cansado: 'El estudiante está cansado: sé muy breve y sugiere una pausa si conviene.',
  ganas: 'El estudiante está motivado: puedes ser entusiasta.',
  normal: 'Tono neutral y amable.',
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

function hechos(step: Any): string {
  if (!step) return 'No hay un ejercicio abierto.';
  return [
    `Algoritmo: ${step.algorithm} (${step.exerciseTitle}).`,
    `Estado: ${step.context}`,
    `Decisión pendiente: ${step.question}`,
    `Línea de pseudocódigo resaltada: ${step.pseudocode?.[step.line] ?? '-'}`,
    step.userAction ? `Acción del estudiante: ${step.userAction} (${step.correct ? 'correcta' : 'incorrecta'}).` : '',
    step.why ? `Condición incumplida según el motor: ${step.why}` : '',
  ].filter(Boolean).join('\n');
}

export function buildPrompt(kind: PromptKind, d: Any): string {
  const p = d.profile;
  const tono = p ? `${TONO[p.calmMode ? 'frustrado' : p.mood] ?? TONO.normal} Nivel: ${p.level}.` : '';
  switch (kind) {
    case 'narrate':
      return `${hechos(d.step)}\n${tono}\nExplica al estudiante por qué su paso fue un "embotellamiento" usando la condición incumplida, sin decirle cuál es la acción correcta. Termina invitándolo a intentarlo de nuevo.`;
    case 'hint': {
      const nivel = d.level as 1 | 2 | 3;
      const guia = {
        1: 'Da una ORIENTACIÓN general sobre qué mirar. NO reveles la acción correcta ni el resultado de la comparación.',
        2: 'Haz una PREGUNTA GUIADA con los valores concretos que lleve al estudiante a decidir. NO reveles la acción correcta.',
        3: 'Da un EJEMPLO RESUELTO análogo y luego indica la acción correcta para este paso.',
      }[nivel];
      return `${hechos(d.step)}\nPista base del motor (nivel ${nivel}): ${d.step.hints[nivel - 1]}\n${tono}\n${guia}`;
    }
    case 'ask':
      return `${hechos(d.step)}\n${tono}\nPregunta del estudiante: "${d.question}"\nResponde a la pregunta usando los hechos. Si pregunta qué hacer, guíalo sin darle la respuesta directamente.`;
    case 'reflect': {
      const r = d.recap;
      return `El estudiante ${r.completed ? 'terminó' : 'dejó a medias'} "${r.exerciseTitle}" (${r.algorithm}): ${r.steps} pasos, ${r.errors} errores (${JSON.stringify(r.errorTypes)}), ${r.hints} pistas, ${r.undos} retrocesos, ${r.seconds} segundos.\n${tono}\nEscribe un comentario de cierre (reconoce un logro concreto) y termina con UNA pregunta de reflexión sobre por qué funciona el algoritmo.`;
    }
    case 'variant': {
      const r = d.req;
      const forma = r.algorithm === 'bst'
        ? '{"titulo": string, "metafora": string, "inserciones": number[] (6 a 10 enteros distintos entre 1 y 99)}'
        : r.algorithm === 'bfs' || r.algorithm === 'dijkstra'
          ? `{"titulo": string, "metafora": string, "grafo": {"nodos": string[] (4 a 8 letras), "aristas": [[u, v${r.algorithm === 'dijkstra' ? ', minutos (1-9)' : ''}], ...] (grafo conexo)}, "inicio": string, "destino": string}`
          : '{"titulo": string, "metafora": string, "datos": number[] (5 a 9 enteros entre 1 y 99)}';
      return `Crea un ejercicio de ${r.algorithm} de nivel ${r.level} con una metáfora urbana breve. Debe entrenar especialmente estos errores del estudiante: ${r.weakSpots.join(', ') || 'ninguno en particular'} (por ejemplo, valores parecidos o repetidos si falla al comparar, o empates de distancia si falla al elegir estaciones).\nResponde SOLO con JSON con esta forma: ${forma}`;
    }
  }
}
