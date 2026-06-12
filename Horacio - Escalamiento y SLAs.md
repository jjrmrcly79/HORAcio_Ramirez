---
tipo: solucion-nexia
area: producción
fecha: 2026-06-11
participantes: Juan Garcés (Consultor NEXIA)
ronda: 3-gemba
estado: crudo
version: 0.1
---

# Horacio — Escalamiento y SLAs

#mapartel #solucion-nexia #reinforcement #riesgo-sustain #revisar

> **Esta nota es la condición de encendido del bot.** El HxH original murió por silencio: las líderes reportaban y nadie reaccionaba (R2-07). Horacio NO manda su primer ping hasta que cada fila de esta tabla tenga dueño que la firmó. #riesgo-sustain

---

## Matriz de escalamiento

| Evento | Notifica al instante a | SLA de reacción propuesto | Cierre del loop (Horacio avisa a la líder) |
|---|---|---|---|
| Paro (cualquier causa) | Daniel Nava | Acuse en ≤15 min | "Daniel ya lo vio" |
| Falta / material invertido | Nayeli + almacén | Acuse ≤15 min, plan ≤2 h | "Tu faltante de [NP] ya se está surtiendo" |
| Calidad | Marco Sotelo | Acuse ≤30 min | "Marco ya lo tiene" |
| Falla de máquina | JC (Mantenimiento) | Acuse ≤15 min | "JC va para allá" |
| Tema delicado (accidente/conflicto) | Daniel Nava + supervisor | Inmediato | — (fuera de flujo normal) |
| Resumen del día | Jorge (Dirección), 17:00 | Lectura, sin SLA | — |

⚠️ SLAs **propuestos** — validar y firmar con cada dueño en la sesión de cierre del 12-jun #revisar.

## Reglas anti-muerte-del-bot

- **El acuse es obligatorio:** el dueño responde con 1 tap ("Visto 👍"); Horacio se lo transmite a la líder. Reportar tiene que tener consecuencia visible (Reinforcement ADKAR).
- **Si un dueño no acusa en SLA:** Horacio reenvía UNA vez. Los no-acuses salen en el resumen de las 17:00 a Jorge — la presión es por transparencia, no por regaño.
- **Métrica de adopción del piloto:** >80% de pings respondidos durante 2 semanas → migrar a WhatsApp y escalar al piso (criterio SN-04 v2). Medirla en el pizarrón + resumen semanal.
- **Privacidad:** números de teléfono con consentimiento vía Ivonne/RH. El resumen a Dirección lleva líneas, nunca nombres de operadoras.

## Links

- [[Horacio - System Prompt (SN-04 v2)]] · [[Horacio - Catalogo Causas de Paro]] · [[Horacio - Catalogo Lineas y Estandares]]
- [[SN-04 Andon Light vía WhatsApp]] · [[2026-06-12 - Cierre Semana Gemba (Guía de Sesión)]]
- [[MOC - ADKAR]]
