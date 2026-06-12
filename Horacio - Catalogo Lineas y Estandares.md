---
tipo: solucion-nexia
area: producción
fecha: 2026-06-11
participantes: Juan Garcés (Consultor NEXIA)
ronda: 3-gemba
estado: crudo
version: 0.1
---

# Horacio — Catálogo de Líneas y Estándares

#mapartel #solucion-nexia #baseline #dato-faltante #revisar

> Base de conocimiento que Horacio carga como contexto. Fuente de verdad de líneas, líderes piloto, horarios y estándares. **Solo se actualiza desde aquí** — n8n la lee, nunca la edita.
> Evidencia origen: [[2026-06-09 - HxH Piso (SMT 520, CIL3, Andromeda) y Ciclo de Ola]] y [[14 - Estandar X Hora - Capacidad por Estacion]].

---

## Turno y ritmo de pings

| Parámetro | Valor | Fuente |
|---|---|---|
| Turno matutino | 6:30 – 15:30 (93% de la plantilla) | R3-DEM |
| Pings HxH | Cada hora en punto +5 min, 7:35 a 15:35 | SN-04 v2 |
| Primera hora | Esperar paro de liberación (~50 min típico en SMT) — ping 7:35 pregunta por 6:30-7:30 | Golden Hour |
| Resumen líder | 15:40 (su línea, su dato) | SN-04 v2 |
| Resumen Jorge | 17:00 (cubre turnos extendidos) | SN-04 v2 |

## Líneas del piloto

| Línea | Líder (piloto) | Estándar | Estatus estándar |
|---|---|---|---|
| SMT 520 | Viridiana Escalona ("Viri") | Por modelo — ej. TJ000360: 102 tarjetas/hr | ✅ Oficial (formato FPR01.F) |
| CIL3 1V4 | (identificar líder) #revisar | Variable por hora, prorrateado | ⚠️ Criterio de llenado no estándar #revisar |
| Andromeda | (identificar líder) #revisar | Pizarrón maneja 85–170/hr | ❌ SIN estándar oficial — "estándar por validar" #dato-faltante |
| + 2 líneas por definir con Pamela | Yadira + 1 | — | #revisar |

## Regla de prorrateo (la que ya usa el piso)

```
plan de la hora = estándar × tiempo_productivo(min) / 60
```

- Comida y pausas programadas reducen `tiempo_productivo`, NO cuentan como paro.
- Horacio nunca inventa estándar: si la línea no tiene oficial, registra real y marca "estándar por validar".

## Criterios que el HxH papel hoy NO estandariza (Horacio sí debe)

- **Dif acumulada vs por-hora:** los pizarrones mezclan criterios (CIL3 y Andromeda #revisar). Horacio guarda real POR HORA y calcula el acumulado él — una sola fuente de criterio.
- **Filas tachadas / pausas sin causa:** en papel se tachan; con Horacio toda hora sin producción lleva causa de catálogo o "sin dato".

## Links

- [[Horacio - System Prompt (SN-04 v2)]] · [[Horacio - Catalogo Causas de Paro]] · [[Horacio - Escalamiento y SLAs]]
- [[14 - Estandar X Hora - Capacidad por Estacion]] · [[MOC - Producción y SMT]]
