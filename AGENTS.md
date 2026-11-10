# AGENTS.md — Guía Operativa y de Refactorización (AlgoCity UNI)

## 1. Contexto del Proyecto y Objetivo de la Refactorización
**AlgoCity** es una aplicación web progresiva (PWA) educativa e inclusiva desarrollada para el curso **CC451-A Interacción Humano-Computador (UNI, 2026-II)**.

### El Pivote de Dominio ("Utilidad Real")
El proyecto originalmente representaba algoritmos como una ciudad genérica (ej. ordenar rascacielos por número de pisos arbitrarios). **El objetivo de esta refactorización es transformar AlgoCity en un asistente operativo y de navegación real sobre el campus de la Universidad Nacional de Ingeniería (UNI)**, manteniendo exactamente los 6 algoritmos clásicos y los requerimientos funcionales/no funcionales (RF/RNF) ya comprometidos en el informe PC02.

### Nuevo Mapeo de Dominio (Campus UNI)
Todo texto de interfaz, datos simulados (`data/mock/`) y visualizaciones SVG deben migrar de metáforas genéricas a problemas reales del estudiante de la UNI:
1. **`bubble` (Bubble Sort):** Ordenar las **Bibliotecas de Facultad** (FC, FIIS, FIC, FIEE, Biblioteca Central) según su **aforo libre en tiempo real** (lugares disponibles) o nivel de silencio, comparando vecinas adyacentes.
2. **`merge` (Merge Sort):** Fusionar listas ordenadas de **turnos/colas del Comedor Universitario** o listas de horarios de buses alimentadores/Metropolitano para despacho unificado.
3. **`quick` (Quick Sort):** Clasificar **pabellones y servicios de la UNI** alrededor de un umbral ("pivote") de tiempo de caminata o presupuesto de mantenimiento.
4. **`bst` (Binary Search Tree):** Buscador indexado de **laboratorios y aulas (ej. CTIC, Pabellón R)** por capacidad exacta de estudiantes para asignar exámenes o prácticas.
5. **`bfs` (Breadth-First Search):** Mapa de cobertura por saltos desde la ubicación actual para hallar el **servicio de emergencia/tópico, fotocopiadora o acceso accesible** más cercano por número de pabellones adyacentes.
6. **`dijkstra` (Dijkstra):** Cálculo de la **ruta peatonal accesible más rápida** dentro del campus (ej. desde Puerta 3 / Estación UNI del Metropolitano hacia Pabellón R, CTIC o CISMID) ponderando distancia en metros y bloqueos por obras.

---

## 2. Estructura del Repositorio y Archivos Clave
- `README.md`: Documentación principal (debe reflejar el enfoque Campus UNI sin perder la tabla de requisitos del curso).
- `src/llm/LLMProvider.ts`: Capa de abstracción del LLM (`LLMProvider`, `FallbackProvider`, `CannedProvider`).
- `data/mock/`:
  - `ejercicios.json`: Definición de los 6 algoritmos con nodos, aristas (distancias en metros entre pabellones UNI) y arreglos de datos reales (aforos/tiempos).
  - `usuarios.json`: Perfiles de estudiantes y docentes con preferencias de accesibilidad.
  - `salas.json`: Salas cooperativas, de duelo y de clase.
  - `sesiones.json`: Historial de telemetría, pasos, errores y estados emocionales.
- `prototipo/index.html`: Prototipo interactivo autónomo (HTML5 + CSS3 + Vanilla JS + SVG + Web Speech API) con las 10 pantallas (`P01` a `P10`).
- `docs/arquitectura-c4.md`: Especificación arquitectónica C4.

---

## 3. Stack Tecnológico y Herramientas
- **Lenguajes:** TypeScript (modo estricto en `src/`), HTML5 semántico, CSS3 con Custom Properties, JavaScript ES2022+ en el prototipo, JSON válido en `data/mock/`.
- **Interfaces de Voz:** Web Speech API nativa (`SpeechRecognition` y `SpeechSynthesis` configuradas en `es-PE`).
- **Gráficos:** SVG dinámico inyectado y manipulado vía DOM (vista 2.5D para barras/pabellones y vista de grafo esquemático sobre el mapa de la UNI para BFS/Dijkstra).
- **LLM & Backend (Fase F4):** Node.js 20+, Express, Socket.IO, proveedores LLM intercambiables (Remoto API / Local Ollama / `CannedProvider` offline).

---

## 4. Reglas de Comportamiento del Agente
1. **Ejecución Secuencial Basada en Evidencia:** Cuando trabajes con `TASKS.md`, ejecuta **una sola tarea a la vez**. No pases a la siguiente tarea hasta haber ejecutado el comando o criterio de verificación de la tarea actual y confirmado que pasa sin errores.
2. **Prohibido Romper Funcionalidades Existentes:** El prototipo (`prototipo/index.html`) ya tiene navegación funcional entre `P01` y `P10`, reconocimiento de voz, TTS, historial de pasos ("retrocede el tiempo"), detección de errores ("embotellamiento") y controles de accesibilidad. Ningún cambio debe degradar estas funciones.
3. **Mínima Fricción de Dependencias:** No introduzcas frameworks pesados ni librerías externas que requieran API keys de pago para los mapas. Usa SVG vectorial limpio y coordenadas relativas del campus UNI.
4. **Ediciones Quirúrgicas:** Antes de modificar un archivo, léelo completo para comprender las referencias cruzadas (IDs del DOM, nombres de clases CSS, tipos en TypeScript y llaves en JSON).
5. **Idioma y Tono:** Todo el código, comentarios, commits y textos de interfaz deben estar en **español claro**. Los mensajes del asistente ("Arquitecto Jefe UNI") nunca deben culpar al usuario (cumplimiento de RNF-12).

---

## 5. Buenas Prácticas Obligatorias

### 5.1 Accesibilidad e Inclusión (WCAG 2.2 Nivel AA — RNF-01, RNF-02)
- **Equivalencia Multimodal (RF-05):** Todo comando de voz debe tener su botón, chip de atajo o entrada por teclado equivalente funcionando con la misma función controladora (`procesar()`).
- **Objetivos Táctiles:** Todo botón o control interactivo debe mantener `min-height: 44px` y `min-width: 44px`.
- **No Dependencia del Color:** Los estados de los nodos/pabellones (comparando, ordenado/visitado, bloqueo/error) deben distinguirse por color + borde/icono + etiqueta textual.
- **Atributos ARIA:** Mantener y actualizar `aria-live="polite"` en el diálogo del Arquitecto Jefe, `role="alert"` en los avisos de bloqueo/embotellamiento, `aria-pressed` en selectores de estado y `aria-label` descriptivos en el lienzo SVG.
- **Escalado y Contraste:** Respetar las variables CSS `--escala` y el selector `:root[data-contraste="alto"]`.

### 5.2 Arquitectura y Tipado (`src/llm/LLMProvider.ts`)
- Mantener los identificadores de algoritmos (`'bubble' | 'merge' | 'quick' | 'bst' | 'bfs' | 'dijkstra'`) y tipos de error (`ErrorType`) para no romper la trazabilidad con el informe.
- Extender `StepEvent` o los tipos de retorno de `variant()` de forma retrocompatible si se agregan estructuras de grafos (nodos/aristas del campus UNI).
- Garantizar que `FallbackProvider` conserve su timeout (`Promise.race` a 3000 ms) y que `CannedProvider` devuelva textos contextualizados al campus de la UNI sin requerir red.

### 5.3 Seguridad y Privacidad (DevSecOps & RNF-07)
- **Cero Secretos en Código:** Nunca escribir API keys ni tokens en archivos rastreados. Usar únicamente variables de entorno referenciadas en `.env.example`.
- **Sanitización del DOM:** Evitar inyecciones inseguras al procesar entradas de texto del usuario (`#cmd`); tratar la entrada del usuario como texto plano antes de insertarla en `#transcrito`.
- **Privacidad por Diseño:** No almacenar blobs de audio en `localStorage` ni en sesiones.

### 5.4 Calidad de Datos (`data/mock/*.json`)
- Todos los archivos JSON deben ser sintácticamente válidos (verificables con `jq` o `node -e "JSON.parse(...)"`).
- Mantener la integridad referencial: los IDs de ejercicios (`e01`..`e07`) y usuarios (`u01`..`u05`, `d01`) deben coincidir entre `ejercicios.json`, `usuarios.json`, `salas.json` y `sesiones.json`.
