# TASKS.md — Plan de Ejecución Secuencial (Refactorización AlgoCity UNI)

> **Instrucción estricta para el Agente:**
> Ejecuta estas tareas en orden secuencial (`Tarea 1` -> `Tarea 6`).
> **PROHIBIDO** iniciar la siguiente tarea sin antes ejecutar el comando de **Verificación de Éxito (Gate Check)** de la tarea actual en la terminal y comprobar que retorna salida exitosa (`exit code 0`).

---

## Tarea 1: Refactorizar `data/mock/ejercicios.json` al Dominio del Campus UNI

### Objetivo Claro
Reemplazar las metáforas genéricas de rascacielos y estaciones abstractas en `data/mock/ejercicios.json` por ubicaciones, infraestructuras y métricas reales de la Universidad Nacional de Ingeniería (UNI), manteniendo los IDs (`e01` a `e07`) y los 6 nombres de algoritmos (`bubble`, `merge`, `quick`, `bst`, `bfs`, `dijkstra`).

### Acciones Requeridas
1. **`e01` (`bubble`, básico):** Cambiar metáfora a *"Bibliotecas de facultad (FC, FIIS, FIC, FIEE, Central) que se comparan de dos en dos por lugares libres"*. Mantener `"datos": [5, 8, 3, 6, 2]` y agregar un arreglo opcional `"etiquetas": ["Bib. FC", "Bib. FIIS", "Bib. FIC", "Bib. FIEE", "Bib. Central"]`.
2. **`e02` (`bubble`, intermedio):** Cambiar metáfora a *"Salas de estudio de la UNI con aforos disponibles similares"*. Mantener `"datos": [6, 5, 7, 4, 5, 3]`.
3. **`e03` (`merge`, intermedio):** Cambiar metáfora a *"Colas de turnos del Comedor Universitario que se dividen y fusionan ordenadas por tiempo de atención"*. Mantener `"datos": [38, 27, 43, 3, 9, 82, 10]`.
4. **`e04` (`quick`, intermedio):** Cambiar metáfora a *"Pabellones de la UNI clasificados respecto a un presupuesto pivote de mantenimiento"*. Mantener `"datos": [10, 80, 30, 90, 40, 50, 70]`.
5. **`e05` (`bst`, intermedio):** Cambiar metáfora a *"Índice de laboratorios del CTIC y Pabellón R organizados por capacidad de alumnos"*. Mantener `"inserciones": [50, 30, 70, 20, 40, 60, 80, 15]`.
6. **`e06` (`bfs`, avanzado):** Cambiar metáfora a *"Red peatonal entre pabellones UNI para hallar el tópico o servicio accesible más cercano por saltos"*. Actualizar `"nodos": ["Puerta 3", "Pab. Central", "Biblioteca", "Pab. R (FC)", "Comedor", "CTIC"]`, ajustar `"aristas"` conectando esos nombres exactamente y definir `"inicio": "Puerta 3"`.
7. **`e07` (`dijkstra`, avanzado):** Cambiar metáfora a *"Ruta peatonal óptima en metros dentro del campus UNI evitando tramos cerrados"*. Actualizar `"nodos": ["Puerta 3", "Pab. Central", "Biblioteca", "Pab. R (FC)", "CTIC"]`, actualizar `"aristas"` con pesos en metros o minutos (ej. `["Puerta 3", "Pab. Central", 2]`, `["Puerta 3", "Biblioteca", 4]`, `["Biblioteca", "Pab. Central", 1]`, `["Pab. Central", "Pab. R (FC)", 5]`, `["Biblioteca", "CTIC", 8]`, `["Pab. R (FC)", "CTIC", 3]`) y `"inicio": "Puerta 3"`.

### Verificación de Éxito (Gate Check 1)
Ejecuta el siguiente comando para validar sintaxis JSON, integridad de los 7 ejercicios y presencia de nodos reales de la UNI:
```bash
node -e '
const fs = require("fs");
const data = JSON.parse(fs.readFileSync("data/mock/ejercicios.json", "utf8"));
if (data.length !== 7) throw new Error("Deben existir exactamente 7 ejercicios");
const e07 = data.find(e => e.id === "e07");
if (!e07.grafo.nodos.includes("Puerta 3") || !e07.grafo.nodos.includes("CTIC")) {
  throw new Error("e07 no contiene los nodos del campus UNI");
}
console.log("TAREA 1 OK");
'

```

* **Condición de avance:** Si imprime `TAREA 1 OK`, pasa a la Tarea 2.

---

## Tarea 2: Alinear `sesiones.json`, `salas.json` y `usuarios.json` al Contexto UNI

### Objetivo Claro

Actualizar los textos narrativos, comandos de historial y reflexiones en `data/mock/sesiones.json`, `data/mock/salas.json` y `data/mock/usuarios.json` para que reflejen el uso real en el campus de la UNI sin alterar ningún `id`, `codigo` de sala (`URB-4821`, `CLS-2026`, `DUE-7730`) ni contadores numéricos.

### Acciones Requeridas

1. En `data/mock/sesiones.json`:
* En `x01`, cambiar la reflexión a: `"La biblioteca con mayor aforo libre queda al final del recorrido en la primera pasada."`
* Mantener intactos los comandos (`"intercambia el edificio 8 con el 5"`, `"retrocede el tiempo"`, `"dame una pista"`, `"avanza"`, `"intercambia"`) o permitir alias compatibles con pabellones/bibliotecas.


2. Verificar que `data/mock/usuarios.json` y `data/mock/salas.json` mantengan integridad referencial con `ejercicios.json`.

### Verificación de Éxito (Gate Check 2)

```bash
node -e '
const fs = require("fs");
["usuarios.json", "salas.json", "sesiones.json"].forEach(f => {
  JSON.parse(fs.readFileSync("data/mock/" + f, "utf8"));
});
const s = JSON.parse(fs.readFileSync("data/mock/sesiones.json", "utf8"));
if (!s[0].reflexion.toLowerCase().includes("biblioteca") && !s[0].reflexion.toLowerCase().includes("aforo")) {
  throw new Error("Falta contextualizar la reflexión en sesiones.json");
}
console.log("TAREA 2 OK");
'

```

* **Condición de avance:** Si imprime `TAREA 2 OK`, pasa a la Tarea 3.

---

## Tarea 3: Actualizar la Capa de Abstracción `src/llm/LLMProvider.ts`

### Objetivo Claro

Adaptar los mensajes predeterminados de `CannedProvider` y la documentación/tipos en `src/llm/LLMProvider.ts` para que el asistente **Arquitecto Jefe UNI** responda en términos de infraestructura del campus (pabellones, bibliotecas, aforo libre y rutas peatonales de la UNI), preservando intactos los contratos exportados y el `FallbackProvider` (timeout de 3000 ms).

### Acciones Requeridas

1. Mantener las firmas exactas de `AlgorithmId`, `ErrorType`, `Mood`, `StepEvent`, `LearnerProfile`, `LLMProvider`, `FallbackProvider` y `CannedProvider`.
2. Agregar un campo opcional `labels?: string[]` en `StepEvent` para permitir que el proveedor mencione el nombre del pabellón o biblioteca (ej. `"Bib. FC"`, `"Pab. R"`) si está presente.
3. En `CannedProvider.narrate(step)` y `CannedProvider.hint(step, level)`:
* Ajustar las cadenas devueltas para hablar de **aforo/capacidad de los pabellones o bibliotecas del campus UNI** y de **pasajes peatonales bloqueados** en vez de rascacielos genéricos sin contexto.
* Mantener los números comparados (`a` y `b`) explícitos en el texto para no perder claridad pedagógica.



### Verificación de Éxito (Gate Check 3)

```bash
node -e '
const fs = require("fs");
const code = fs.readFileSync("src/llm/LLMProvider.ts", "utf8");
const required = ["export interface LLMProvider", "export class FallbackProvider", "export class CannedProvider", "timeoutMs: 3000"];
required.forEach(r => { if (!code.includes(r)) throw new Error("Falta contrato: " + r); });
if (!/pabell|biblioteca|campus|aforo/i.test(code)) {
  throw new Error("CannedProvider no refleja el dominio del campus UNI");
}
console.log("TAREA 3 OK");
'

```

* **Condición de avance:** Si imprime `TAREA 3 OK`, pasa a la Tarea 4.

---

## Tarea 4: Refactorizar Narrativa, Textos y Catálogo en `prototipo/index.html` (`P01`–`P10`)

### Objetivo Claro

Actualizar los textos descriptivos, títulos y tarjetas del catálogo en `prototipo/index.html` para que el usuario interactúe con el **Planificador Urbano e Infraestructura del Campus UNI**, conservando los 10 identificadores de pantalla (`data-p="P01"` a `data-p="P10"`), la accesibilidad WCAG 2.2 AA y el flujo de botones.

### Acciones Requeridas

1. **`P01` (Bienvenida):** Actualizar el subtítulo para mencionar que el estudiante recorre y optimiza el **campus de la UNI** (bibliotecas, comedor, pabellones, CTIC y rutas peatonales entre puertas) con la voz.
2. **`P03` (Mi ciudad -> Mi Campus UNI):**
* En la tarjeta `.sugerencia`, cambiar *"Ordena el centro financiero"* por *"Optimiza el aforo de Bibliotecas UNI"* explicando que se ordenan las 5 bibliotecas (`Bib. FC`, `Bib. FIIS`, `Bib. FIC`, `Bib. FIEE`, `Bib. Central`) por lugares disponibles en tiempo real.


3. **`P04` (Catálogo de algoritmos):** Actualizar las descripciones de las 6 tarjetas (`.alg`) para reflejar las 6 utilidades reales en la UNI:
* **Bubble Sort:** Ordenar bibliotecas de facultad por lugares libres comparando vecinas.
* **Merge Sort:** Fusionar colas/turnos ordenados del Comedor Universitario.
* **Quick Sort:** Clasificar pabellones alrededor de un umbral pivote de mantenimiento/tiempo.
* **Árbol binario de búsqueda (BST):** Ubicar laboratorios (CTIC / Pabellón R) según su capacidad de alumnos.
* **BFS:** Explorar por ondas qué tópico, fotocopiadora o acceso está a menor número de pabellones desde Puerta 3.
* **Dijkstra:** Calcular la ruta peatonal más corta en metros/minutos entre Puerta 3, Biblioteca, Pabellón R y CTIC.


4. **`P07` (Resumen):** Ajustar la pregunta de reflexión para referirse al pabellón/biblioteca con mayor aforo libre llegando al final en la primera pasada.

### Verificación de Éxito (Gate Check 4)

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync("prototipo/index.html", "utf8");
["P01","P02","P03","P04","P05","P07","P08","P09","P10"].forEach(p => {
  if (!html.includes(`data-p="${p}"`)) throw new Error("Falta pantalla " + p);
});
if (!html.includes("CTIC") || !html.includes("Comedor") || !html.includes("Puerta 3")) {
  throw new Error("El catálogo y las pantallas no reflejan la infraestructura real de la UNI");
}
console.log("TAREA 4 OK");
'

```

* **Condición de avance:** Si imprime `TAREA 4 OK`, pasa a la Tarea 5.

---

## Tarea 5: Enriquecer el Lienzo SVG y la Simulación en `prototipo/index.html` (`P05` y `P09`)

### Objetivo Claro

Conectar la simulación interactiva de `P05` y `P09` al dominio real de la UNI mostrando etiquetas de pabellones/bibliotecas reales en el SVG (`Bib. FC`, `Bib. FIIS`, `Bib. FIC`, `Bib. FIEE`, `Bib. Central`) junto con su índice `A[k]` y su valor numérico (`[5, 8, 3, 6, 2]` lugares libres/x10), y agregar un selector o vista de previsualización de la ruta de campus UNI (grafo de pabellones) sin romper ningún comando de voz ni función global (`window.irA`, `window.procesar`, `window.estado`).

### Acciones Requeridas

1. En el script de `prototipo/index.html`, asociar a cada elemento del arreglo `INI = [5, 8, 3, 6, 2]` el nombre real del edificio/biblioteca de la UNI (por ejemplo, manteniendo un arreglo paralelo de objetos o etiquetas que se intercambian junto con `A[j]` y `A[j+1]`).
2. En la función `dibujar(destino)`:
* Mostrar sobre o debajo de cada edificio en el SVG tanto la notación algorítmica (`A[0]`..`A[4]`) como la etiqueta real abreviada (`FC`, `FIIS`, `FIC`, `FIEE`, `BCEN`) y su cantidad de lugares/aforo (`5`, `8`, `3`, `6`, `2`).


3. Mantener intacta la compatibilidad de comandos en `procesar(txt)`:
* Comandos como `"Intercambia el edificio 8 con el 5"`, `"intercambia"`, `"avanza"`, `"retrocede el tiempo"`, `"dame una pista"`, `"¿qué puedo decir?"` y `"más lento"` deben seguir funcionando exactamente con las mismas expresiones regulares para no romper el flujo de prueba del README ni las capturas.


4. Asegurar que `window.estado('error')`, `window.estado('medio')` y `window.estado('fin')` sigan funcionando sin errores de consola.

### Verificación de Éxito (Gate Check 5)

```bash
node -e '
const fs = require("fs");
const html = fs.readFileSync("prototipo/index.html", "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (!scriptMatch) throw new Error("No se encontró el bloque <script>");
new Function(scriptMatch[1]); // Verifica que el JS no tenga errores de sintaxis
["window.irA", "window.procesar", "window.estado", "SpeechRecognition", "speechSynthesis"].forEach(fn => {
  if (!html.includes(fn)) throw new Error("Se perdió funcionalidad clave: " + fn);
});
["FIIS", "FIC", "FIEE"].forEach(fac => {
  if (!html.includes(fac)) throw new Error("El SVG/simulación no incluye la facultad: " + fac);
});
console.log("TAREA 5 OK");
'

```

* **Condición de avance:** Si imprime `TAREA 5 OK`, pasa a la Tarea 6.

---

## Tarea 6: Actualizar `README.md` y Ejecutar Auditoría Integral del Repositorio

### Objetivo Claro

Actualizar `README.md` para explicar el enfoque de utilidad real en el campus de la UNI (gestión de aforos en bibliotecas/comedor, búsqueda de laboratorios en CTIC/Pabellón R y rutas óptimas con BFS/Dijkstra entre puertas y pabellones), mantendo la guía de instalación, el flujo de simulación y la tabla de integrantes.

### Acciones Requeridas

1. En `README.md`:
* Describir en el primer párrafo cómo **AlgoCity** convierte el **campus de la UNI** en una ciudad navegable donde los 6 algoritmos resuelven problemas cotidianos de los estudiantes (aforo de bibliotecas, colas del comedor, reserva de laboratorios y rutas peatonales entre Puerta 3, Pabellón R y CTIC).
* Actualizar la tabla de `data/mock/ejercicios.json` para mencionar su aplicación práctica en el campus UNI.
* Mantener intactos los pasos de `"Flujo sugerido para la simulación"` para que el evaluador pueda probar los mismos atajos sin fricción.


2. Ejecutar una validación global de todos los archivos modificados.

### Verificación de Éxito (Gate Check 6 — Final)

```bash
node -e '
const fs = require("fs");
["ejercicios.json", "usuarios.json", "salas.json", "sesiones.json"].forEach(f => {
  JSON.parse(fs.readFileSync("data/mock/" + f, "utf8"));
});
const readme = fs.readFileSync("README.md", "utf8");
if (!readme.includes("20222117F") || !readme.includes("Bubble Sort") || !readme.includes("CTIC")) {
  throw new Error("README.md incompleto o perdió metadatos del equipo/proyecto");
}
console.log("AUDITORIA FINAL EXITOSA: TODAS LAS TAREAS COMPLETADAS");
'

```

* **Condición de cierre:** Cuando la terminal imprima `AUDITORIA FINAL EXITOSA: TODAS LAS TAREAS COMPLETADAS`, reporta al usuario un resumen conciso de los cambios realizados por archivo.
