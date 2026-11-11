# AlgoCity · Avance del proyecto (PC03)

CC451-A Interacción Humano-Computador · UNI 2026-II
Equipo: Diego Pineda (20222117F), Andre Sanchez (20220043E), Luis Trujillo (20220428D)

Este documento es la evidencia de la parte 1 de la PC03: para cada historia de usuario del informe PC02 se indica el requerimiento que cubre, el módulo que lo implementa (con enlace al código) y la captura de la aplicación funcionando. Todas las capturas las genera `npm run capturas`, que recorre la app real en Chrome y **resuelve los 6 algoritmos con los mismos comandos que se dicen por voz**.

## 1. Resumen del avance

| Aspecto | PC02 | PC03 |
|---|---|---|
| Algoritmos funcionando | 1 (Bubble Sort, simulado en HTML) | **6** (Bubble, Merge, Quick, BST, BFS, Dijkstra) con motor que valida cada paso |
| Pantallas | 10 maquetas navegables | **11 pantallas funcionales** (P01–P11) |
| Voz | Web Speech API en el prototipo | `VoiceProvider` (Web Speech API + Whisper de respaldo), confirmación con confianza < 0,7, TTS con tono adaptado |
| LLM | Interfaz `LLMProvider` sin usar | Conectado: cadena remoto → Ollama → predefinido; pistas, explicaciones, preguntas libres, reflexión y variantes |
| PWA | — | Manifest, service worker, instalable, ejercicios sin conexión |
| Personalización | Datos simulados | Perfil persistente, ánimo declarado e inferido, recomendación del siguiente reto, insignias |
| Multiusuario | Pantallas estáticas | Salas cooperativas (turnos), duelo y clase con panel docente en tiempo real |
| Pruebas | — | 56 pruebas unitarias + recorrido de punta a punta en navegador |

## 2. Trazabilidad: historia de usuario → módulo → evidencia

| HU | Historia (resumen) | RF / RNF | Módulo que la implementa | Evidencia |
|---|---|---|---|---|
| HU-01 | Entrar como invitado o con código de sala | RF-01 | [`screens/Bienvenida.tsx`](../web/src/screens/Bienvenida.tsx) | [P01](img/pc03/P01_bienvenida.png) |
| HU-02 | Configurar texto, contraste y narración antes de empezar | RF-02, RNF-01, RNF-02 | [`screens/Preferencias.tsx`](../web/src/screens/Preferencias.tsx), [`state/store.tsx`](../web/src/state/store.tsx) | [P02](img/pc03/P02_preferencias.png), [alto contraste](img/pc03/movil_alto_contraste.png) |
| HU-03 | Controlar el algoritmo con la voz | RF-03, RNF-03 | [`voice/voice.ts`](../web/src/voice/voice.ts), [`shared/commands.ts`](../shared/commands.ts), [`practice/usePractice.ts`](../web/src/practice/usePractice.ts) (`input`) | [P05 Bubble](img/pc03/P05_bubble.png) |
| HU-03.2 | Confirmar si la confianza es menor a 0,7 | RF-03 | `usePractice.input` → diálogo “¿Quisiste decir…?” | código |
| HU-03.3 | Frase que no es comando: no cambia la ciudad | RF-03 | `parseCommand` → `unknown` | [P06](img/pc03/P06_que_puedo_decir.png) (mensaje anterior al diálogo) |
| HU-04 | Escuchar la narración de cada paso y regular la velocidad | RF-04 | `tts` en [`voice/voice.ts`](../web/src/voice/voice.ts); comandos “más lento / más rápido” guardan la velocidad en el perfil | [P02](img/pc03/P02_preferencias.png) |
| HU-05 | Usar todo sin voz (teclado, botones, texto) | RF-05, RNF-01 | [`components/PracticeView.tsx`](../web/src/components/PracticeView.tsx) (atajos I, A, ←, →, Z, P, R, ?), estaciones del metro accesibles con teclado | [P05 Quick](img/pc03/P05_quick.png) |
| HU-06 | Elegir el algoritmo desde un catálogo | RF-06 | [`screens/Catalogo.tsx`](../web/src/screens/Catalogo.tsx) | [P04](img/pc03/P04_catalogo.png) |
| HU-07 | Ver el pseudocódigo resaltado junto a la animación | RF-07 | `Engine.line()` en [`shared/engines`](../shared/engines), panel “Plano del algoritmo” | [P05 BST](img/pc03/P05_bst.png) |
| HU-08 | Ver por qué el paso fue incorrecto (embotellamiento) | RF-08 | `Engine.step()` devuelve la condición incumplida; animación en [`city/Buildings.tsx`](../web/src/city/Buildings.tsx) | [Bubble](img/pc03/P05_bubble_error.png), [Dijkstra](img/pc03/P05_dijkstra_error.png) |
| HU-09 | Retroceder el tiempo y reiniciar | RF-09 | `usePractice.undo` / `restart` (historial de estados) | [Resumen con insignia “Viajero del tiempo”](img/pc03/P07_resumen.png) |
| HU-10 | Pedir pistas graduales sin que revelen la respuesta | RF-10, RF-11 | [`shared/llm/prompts.ts`](../shared/llm/prompts.ts) (niveles 1–3), `Engine.hints()` como base | [P05 pistas](img/pc03/P05_bubble_pistas.png) |
| HU-11 | Cambiar de proveedor LLM sin tocar otros módulos | RF-11, RNF-08 | [`shared/llm/LLMProvider.ts`](../shared/llm/LLMProvider.ts), [`server/llm.ts`](../server/llm.ts), [`.env.example`](../.env.example); prueba de conmutación en [`tests/profile.test.ts`](../tests/profile.test.ts) | pruebas |
| HU-12 | Practicar variantes ajustadas a mis errores | RF-12 | `LLMProvider.variant` + validación; generador local `generateVariant` en [`shared/exercises.ts`](../shared/exercises.ts) | [P03 reto enfocado](img/pc03/P03_mi_ciudad.png) |
| HU-13 | Que la app recuerde mis errores y mi progreso | RF-13, RF-14 | [`shared/profile.ts`](../shared/profile.ts) (`recordSession`, `recommend`) | [P10](img/pc03/P10_perfil.png), [P03](img/pc03/P03_mi_ciudad.png) |
| HU-14 | Indicar cómo me siento y que el asistente se adapte | RF-15, RNF-12 | `inferMood`, `toneFor` en [`shared/profile.ts`](../shared/profile.ts); tono y voz en `usePractice` | [frustración → modo calma](img/pc03/P05_frustracion_modo_calma.png) |
| HU-15 | Crear o unirme a una sala cooperativa o de duelo | RF-16, RF-01 | [`screens/Salas.tsx`](../web/src/screens/Salas.tsx), [`server/rooms.ts`](../server/rooms.ts) | [P08](img/pc03/P08_salas.png) |
| HU-16 | Ver en tiempo real lo que hacen los demás; turnos por voz | RF-17, RNF-09 | [`server/index.ts`](../server/index.ts) (Socket.IO), `RoomManager.coopAction` | [P09 Andre](img/pc03/P09_sala_cooperativa.png), [P09 Luis](img/pc03/P09_sala_cooperativa_otro.png) |
| HU-17 | Ver un resumen y una pregunta de reflexión | RF-18 | [`screens/Resumen.tsx`](../web/src/screens/Resumen.tsx), `LLMProvider.reflect` | [P07](img/pc03/P07_resumen.png) |
| HU-18 | Preguntar “¿qué puedo decir?” | RF-19 | `commandHelp` en [`shared/commands.ts`](../shared/commands.ts), `HelpDialog` | [P06](img/pc03/P06_que_puedo_decir.png) |
| HU-19 | Ver, descargar y borrar mis datos | RF-20, RNF-07 | [`screens/Perfil.tsx`](../web/src/screens/Perfil.tsx) | [P10](img/pc03/P10_perfil.png) |
| HU-20 | Docente: crear sala de clase y ver errores del grupo | RF-21 | `PanelDocente` en [`screens/Sala.tsx`](../web/src/screens/Sala.tsx), `RoomManager.resumenGrupo` | [P11](img/pc03/P11_panel_docente.png) |
| HU-21 | Instalar la app y practicar sin internet | RF-22, RNF-05, RNF-06 | [`vite.config.ts`](../vite.config.ts) (PWA), respaldo local en [`llm/client.ts`](../web/src/llm/client.ts) | `npm run build && npm start` → “Instalar app” |
| HU-22 | Modo calma para TDAH o ansiedad | RF-02, RF-15 | `data-calma` en [`styles.css`](../web/src/styles.css), oferta automática al inferir frustración | [modo calma](img/pc03/P05_frustracion_modo_calma.png) |
| HU-23 | Agregar un algoritmo sin tocar el resto | RNF-10 | Interfaz `Engine` y registro `ENGINES` en [`shared/engines/index.ts`](../shared/engines/index.ts) | código |

### Funcionalidades nuevas que refuerzan la utilidad

| Funcionalidad | Por qué | Evidencia |
|---|---|---|
| **Usar mis datos**: el estudiante escribe el arreglo o el grafo de su práctica | Resuelve su propia tarea, no solo ejemplos | Catálogo → “Usar mis datos” |
| **Modo examen**: sin pistas ni retrocesos, con cronómetro y nota sobre 20 | Preparación para prácticas calificadas | [P05 examen](img/pc03/P05_examen.png) |
| **Preguntas libres** al Arquitecto Jefe (“¿por qué…?”, complejidad, pivote) | Tutor disponible en cualquier paso | [P05 pregunta](img/pc03/P05_merge_pregunta.png) |
| **Mapas del campus UNI** para BFS y Dijkstra | Grafos familiares para el estudiante | [Dijkstra campus](img/pc03/P05_dijkstra.png) |
| **Diseño adaptable** a celular, alto contraste y modo oscuro | Accesibilidad y portabilidad | [móvil](img/pc03/movil_P05_bfs.png), [oscuro](img/pc03/P05_quick_oscuro.png) |

## 3. Requerimientos no funcionales

| RNF | Estado | Cómo |
|---|---|---|
| RNF-01 Accesibilidad WCAG 2.2 AA | Implementado, falta auditoría formal | Contraste ≥ 4,5:1, foco visible, `aria-live` para el asistente, nombres accesibles, foco al título de cada pantalla, enlace “Saltar al contenido” |
| RNF-02 Objetivos de 44×44 px y texto al 200 % | Implementado | Botones de 44–64 px; tres tamaños de texto (hasta 145 %) más el zoom del navegador |
| RNF-03 Respuesta ≤ 300 ms | Implementado | El motor y el intérprete corren en el navegador; el LLM nunca bloquea la animación |
| RNF-04 ≥ 90 % de comandos reconocidos | Pendiente de medir | Se usan las 3 alternativas del reconocedor para elegir la que es un comando válido |
| RNF-05 ≥ 30 fps | Implementado | Escenas SVG livianas; transiciones CSS; respeta “reducir movimiento” |
| RNF-06 PWA instalable, Lighthouse ≥ 90 | Instalable; Lighthouse pendiente de medir | Manifest + service worker (Workbox) |
| RNF-07 Privacidad | Implementado | No se guarda audio; consentimiento para el proveedor remoto (`x-llm-consent`); perfil solo en el dispositivo, descargable y borrable |
| RNF-08 Conmutar de proveedor si no responde en 3 s | Implementado y probado | `FallbackProvider` con `timeoutMs: 3000` |
| RNF-09 8 participantes por sala, 30 salas | Implementado | `CAPACIDAD_MAX` y `MAX_SALAS` en `server/rooms.ts` |
| RNF-10 Mantenibilidad | Implementado | TypeScript estricto; un algoritmo = un archivo que implementa `Engine` |
| RNF-11 SUS ≥ 75 | Pendiente (prueba con usuarios) | — |
| RNF-12 Lenguaje claro y tono | Implementado | Prompts con reglas de tono; textos en español de nivel secundaria |
| RNF-13 Portabilidad y licencia | Implementado | Chrome, Edge, Safari; Firefox con Whisper o texto; licencia MIT |

## 4. Cómo verificar

```bash
npm install
npm test              # 56 pruebas
npm run build && npm start
npm run capturas      # en otra terminal: recorrido completo y capturas
```

## 5. Pendiente para la entrega final

- Cuentas con base de datos para sincronizar el perfil entre dispositivos.
- Whisper dentro del navegador para Firefox sin conexión.
- Prueba con usuarios (SUS), auditoría Lighthouse y medición de reconocimiento de voz.
