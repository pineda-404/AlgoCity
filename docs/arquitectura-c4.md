# Arquitectura de AlgoCity (modelo C4)

Versión PC03. Los diagramas usan Mermaid (GitHub los dibuja directamente). El diagrama de la PC02 se conserva en [`img/c4.png`](img/c4.png).

## Nivel 1 · Contexto

```mermaid
C4Context
  title AlgoCity - Contexto
  Person(est, "Estudiante", "Practica algoritmos con voz, teclado, botones o pantalla táctil")
  Person(doc, "Docente", "Crea salas de clase y revisa el progreso del grupo")
  System(algo, "AlgoCity", "PWA que representa algoritmos como una ciudad navegable")
  System_Ext(llmR, "Proveedor LLM remoto", "Cualquier API compatible con OpenAI: OpenAI, Groq, Gemini, OpenRouter")
  System_Ext(llmL, "LLM local", "Ollama en la laptop")
  System_Ext(stt, "Transcripción Whisper", "Opcional: respaldo para navegadores sin Web Speech API")
  System_Ext(nav, "Navegador", "Web Speech API y speechSynthesis")
  Rel(est, algo, "Usa")
  Rel(doc, algo, "Usa")
  Rel(algo, nav, "Reconoce voz y narra")
  Rel(algo, llmR, "Explicaciones, pistas, variantes", "HTTPS")
  Rel(algo, llmL, "Respaldo", "HTTP local")
  Rel(algo, stt, "Audio de un comando, sin guardarlo", "HTTPS")
```

## Nivel 2 · Contenedores

```mermaid
C4Container
  title AlgoCity - Contenedores
  Person(est, "Estudiante / Docente")
  System_Boundary(s, "AlgoCity") {
    Container(pwa, "PWA cliente", "React, TypeScript, SVG, Web Speech API, Workbox", "Ciudad, voz, perfil adaptativo, modo sin conexión")
    ContainerDb(ls, "Perfil local", "localStorage", "Preferencias, progreso, errores, emociones, historial")
    Container(api, "Servidor de aplicación", "Node.js, Express", "API del LLM y de transcripción; sirve la PWA compilada")
    Container(rt, "Servidor de salas", "Socket.IO (mismo proceso)", "Salas cooperativas, de duelo y de clase con estado autoritativo")
    Component(sh, "Núcleo compartido", "TypeScript", "Motores de algoritmos, intérprete de comandos, perfil, LLMProvider")
  }
  System_Ext(ext, "Proveedores LLM / STT", "Remoto y local")
  Rel(est, pwa, "Usa", "HTTPS")
  Rel(pwa, ls, "Lee y escribe")
  Rel(pwa, api, "REST/JSON")
  Rel(pwa, rt, "WebSocket")
  Rel(pwa, sh, "Importa")
  Rel(rt, sh, "Valida cada acción con el mismo motor")
  Rel(api, sh, "Usa LLMProvider")
  Rel(api, ext, "HTTPS / HTTP local")
```

## Nivel 3 · Componentes

```mermaid
flowchart LR
  subgraph PWA["PWA (web/src)"]
    UI["Pantallas P01–P11<br/>screens/"]
    CB["Mando de voz y texto<br/>components/CommandBar"]
    VP["VoiceProvider<br/>WebSpeechSTT · WhisperSTT · TTS"]
    UP["Sesión de práctica<br/>practice/usePractice"]
    SC["Escenas SVG<br/>city/Buildings · Tree · Metro"]
    ST["Store del perfil<br/>state/store"]
    LC["Cliente LLM con respaldo local<br/>llm/client"]
  end
  subgraph SH["Núcleo compartido (shared)"]
    CMD["Intérprete de comandos<br/>commands.ts"]
    ENG["Motores deterministas<br/>engines/*"]
    PRO["Perfil adaptativo<br/>profile.ts"]
    LLM["LLMProvider<br/>Fallback · OpenAICompatible · Canned"]
  end
  subgraph SRV["Servidor (server)"]
    API["/api/llm/* · /api/stt · /api/salas"]
    ROOM["RoomManager<br/>turnos, progreso, panel docente"]
  end
  CB --> VP
  CB --> UP
  UP --> CMD --> ENG
  UP --> SC
  UP --> PRO
  UP --> LC --> API --> LLM
  LC -. "sin red" .-> LLM
  UI --> ST --> PRO
  UI --> ROOM
  ROOM --> ENG
```

## Flujo de un comando de voz

```mermaid
sequenceDiagram
  actor E as Estudiante
  participant V as VoiceProvider
  participant C as Intérprete
  participant M as Motor
  participant S as Escena
  participant A as Arquitecto Jefe (LLM)
  E->>V: "intercambia"
  V->>C: alternativas + confianza
  alt confianza < 0,7
    C-->>E: ¿Quisiste decir "intercambia"?
  end
  C->>M: acción swap
  M-->>S: estado nuevo o error con la condición incumplida
  S-->>E: animación (≤ 300 ms) y narración TTS
  opt error y hay modelo disponible
    M->>A: hechos del paso + perfil (tono)
    A-->>E: explicación adaptada
  end
```

## Decisiones

| Decisión | Motivo | Requerimiento |
|---|---|---|
| El motor de cada algoritmo es determinista y valida cada paso; el LLM solo recibe los hechos y los explica | El LLM nunca “inventa” un paso incorrecto y la respuesta es inmediata aunque no haya red | RF-07, RF-08, RNF-03 |
| `LLMProvider` con cadena remoto → local → predefinido y tiempo límite de 3 s | Cambio de proveedor por configuración y continuidad sin red | RF-11, RNF-08 |
| Un cliente “compatible con OpenAI” para remoto y local | Un solo adaptador sirve para OpenAI, Groq, Gemini, OpenRouter y Ollama | RF-11 |
| Web Speech API como reconocimiento principal y Whisper como respaldo | Gratis y sin API key en Chrome/Edge/Safari; Firefox queda cubierto por el servidor | RF-03, RNF-13 |
| Intérprete de comandos local con reglas; el LLM solo para preguntas libres | Los comandos son pocos y cortos: reglas responden al instante y sin costo | RF-03, RNF-03 |
| El núcleo (`shared/`) lo usan la PWA y el servidor | La sala cooperativa valida con el mismo motor que la práctica individual | RF-17, RNF-10 |
| Perfil guardado en el dispositivo (localStorage), con descarga y borrado | Privacidad por defecto; no requiere cuentas para el prototipo | RF-13, RF-20, RNF-07 |
| No se guarda audio; sin consentimiento, el texto no sale a un proveedor remoto | Privacidad (Ley N.° 29733) | RNF-07 |
| Escenas en SVG con lienzo más angosto en celulares | ≥ 30 fps en laptop convencional y legibilidad en móvil | RNF-05, RNF-02 |
| Socket.IO con estado autoritativo en el servidor; 8 personas por sala, 30 salas | Turnos consistentes | RF-17, RNF-09 |

## Pendiente para la entrega final

- Cuentas con servidor y base de datos (SQLite/PostgreSQL) para sincronizar el perfil entre dispositivos; hoy el perfil vive en el dispositivo.
- Reconocimiento Whisper ejecutado dentro del navegador (sin servidor) para Firefox sin conexión.
- Mediciones formales: Lighthouse (RNF-06), tasa de reconocimiento de voz (RNF-04) y SUS con usuarios (RNF-11).
