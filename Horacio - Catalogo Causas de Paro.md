---
tipo: solucion-nexia
area: producción
fecha: 2026-06-11
participantes: Juan Garcés (Consultor NEXIA)
ronda: 3-gemba
estado: crudo
version: 0.1
---

# Horacio — Catálogo de Causas de Paro (botones)

#mapartel #solucion-nexia #baseline #desperdicio

> Taxonomía CERRADA de causas — son los botones que ve la líder. Todas salieron de evidencia real del gemba (formato 520, pizarrones CIL3/Andromeda, Golden Hour). Cada causa tiene dueño de reacción → ver [[Horacio - Escalamiento y SLAs]]. Agregar causas solo desde esta nota (alimenta directo el Pareto de [[SN-05 Pareto-IA de Fallas]]).

---

| Código | Botón (texto que ve la líder) | Cuenta como paro | Escala a | Evidencia origen |
|---|---|---|---|---|
| LIB | 🔓 Liberación / arranque | Sí | Calidad (Marco Sotelo) | 50 min en 520, patrón Golden Hour |
| MAT-F | 📦 Falta material | Sí | Nayeli + almacén | Pizarrón Andromeda "material faltante" |
| MAT-I | 🔄 Material invertido / equivocado | Sí | Nayeli + almacén | Pizarrón Andromeda "mat. invertido" |
| RTB | 🔧 Retrabajo de tarjetas | Sí | Calidad (Marco Sotelo) | "se compusieron unas tarjetas" |
| CMB | ⚙️ Cambio de modelo | Sí (mide SMED) | Daniel Nava | Comandos /cambio v1 |
| MAQ | 🛠️ Falla de máquina | Sí | JC (Mantenimiento) | Conformal/robot, R2 |
| COM | 🍽️ Comida / pausa programada | No (ajusta t. productivo) | — | Formatos HxH papel |
| OTRO | ❓ Otra cosa (escribe qué) | Sí | Daniel Nava (clasifica después) | — |

## Reglas

- "Comida/pausa" NO es paro: reduce el tiempo productivo de la hora (prorrateo).
- "OTRO" libre se revisa semanal: si una causa libre se repite 3+ veces, se vuelve botón nuevo (actualizar esta nota y subir `version`).
- La causa la elige la líder en 1 tap — Horacio nunca la deduce ni la corrige.

## Links

- [[Horacio - System Prompt (SN-04 v2)]] · [[Horacio - Escalamiento y SLAs]]
- [[SN-05 Pareto-IA de Fallas]] · [[2026-06-09 - Gemba Golden Hour (Arranque de Turno SMT y PTH)]]
