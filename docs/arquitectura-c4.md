# Arquitectura de AlgoCity (modelo C4)

![Diagrama C4](img/c4.png)

## Nivel 1 · Contexto

```mermaid
C4Context
  title AlgoCity - Contexto
  Person(est, "Estudiante", "Aprende algoritmos con voz, teclado o pantalla táctil")
  Person(doc, "Docente", "Crea salas de clase y revisa errores frecuentes")
  System(algo, "AlgoCity", "PWA que representa algoritmos como una ciudad navegable")
  System_Ext(llmR, "Proveedor LLM remoto", "API compatible (Claude, GPT, Gemini)")
  System_Ext(llmL, "LLM local", "Ollama en la laptop, respaldo sin conexión")
  Rel(est, algo, "Usa")
  Rel(doc, algo, "Usa")
  Rel(algo, llmR, "Narración, pistas, variantes", "HTTPS")
  Rel(algo, llmL, "Respaldo", "HTTP local")
```

## Nivel 2 · Contenedores

```mermaid
C4Container
  title AlgoCity - Contenedores
  Person(est, "Estudiante")
  System_Boundary(s, "AlgoCity") {
    Container(pwa, "PWA cliente", "TypeScript, React, SVG/Three.js, Web Speech API", "Ciudad, voz, modo offline")
    Container(api, "API de aplicación", "Node.js, Express", "Perfiles, ejercicios, validación de pasos")
    Container(rt, "Servidor de salas", "Socket.IO", "Turnos, duelo y cooperativo")
    Component(llm, "Capa LLMProvider", "TypeScript", "Narración, pistas y variantes con respaldo")
    ContainerDb(db, "Base de datos", "SQLite / PostgreSQL", "Perfil adaptativo, progreso, emociones declaradas")
  }
  System_Ext(ext, "Proveedores LLM", "Remoto y local")
  Rel(est, pwa, "Usa", "HTTPS")
  Rel(pwa, api, "REST/JSON")
  Rel(pwa, rt, "WebSocket")
  Rel(api, llm, "Solicita texto")
  Rel(api, db, "Lee/escribe")
  Rel(rt, db, "Guarda estado de sala")
  Rel(llm, ext, "HTTPS / HTTP local")
```

## Decisiones

| Decisión | Motivo | Requerimiento |
|---|---|---|
| El motor de algoritmos es determinista y valida cada paso; el LLM solo narra y da pistas | Evita que el LLM "invente" pasos incorrectos | RF-07, RF-08 |
| `LLMProvider` con cadena de respaldo remoto → local → textos predefinidos | Cambio de proveedor por configuración y continuidad sin red | RF-11, RNF-08 |
| Escenas en SVG por defecto, WebGL opcional | ≥ 30 fps en laptop convencional y celular de gama media | RNF-05 |
| No se almacena audio; solo el texto del comando reconocido | Privacidad (Ley N.° 29733) | RNF-07 |
| Socket.IO con estado autoritativo en el servidor | Turnos consistentes en salas de hasta 8 personas | RF-17, RNF-09 |
