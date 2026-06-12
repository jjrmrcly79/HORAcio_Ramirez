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

> **Corrección 12-jun (Juan):** los pizarrones HxH no son áreas. Las operaciones/estaciones del proceso son las del catálogo de abajo, con tres líderes: **SMT → Viridiana Escalona, PTH → Yadira Magdariaga, Conformal y Producto Terminado → líder por identificar #revisar**. "Andromeda" es una **tarjeta** (NP 22SD72916-06 / familia P/refrigerador), no una línea: su pizarrón es el HxH del área donde corre esa tarjeta. Ver [[Horacio - Organigrama General]].

| Proceso / Estación                             | Líder responsable                               | Estándar conocido                                            | Estatus estándar                            |
| ---------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------- |
| SMT (colocación/hornos) — líneas 411/481 y 520 | Viridiana Escalona ("Viri")                     | Por modelo — ej. tarjeta TJ000360: 102/hr (pizarrón SMT 520) | ✅ Oficial (formato FPR01.F)                 |
| PTH (inserción manual)                         | Yadira Magdariaga                               | TJ000360 en pizarrón CIL3 1V4: variable/prorrateado          | ⚠️ Criterio de llenado no estándar #revisar |
| Máquina de ola                                 | Yadira Magdariaga                               | Ciclo medido: 294 s/pasada (tarjeta Andromeda)               | #baseline; falta pzs/hr                     |
| Soldadura manual / retrabajo                   | Yadira Magdariaga                               | "caben 50" por operadora (dicho de líder) #revisar           | ❌ Sin oficial                               |
| Inspección visual / Calidad                    | (Calidad — Marco Sotelo)                        | —                                                            | #dato-faltante                              |
| Pruebas ICT/FCT                                | Yadira Magdariaga                               | —                                                            | #dato-faltante                              |
| Conformal                                      | Líder Conformal y PT (por identificar #revisar) | —                                                            | #dato-faltante                              |
| Armado de arneses                              | #revisar                                        | —                                                            | #dato-faltante                              |
| Kitting / surtido almacén                      | Lidia Pérez (almacén)                           | —                                                            | —                                           |

> Tarjetas observadas en pizarrones HxH: TJ000360 (SMT 520 a 102/hr y CIL3 1V4 prorrateado) y **Andromeda** 22SD72916-06 (85–170/hr **sin estándar oficial**, origen por validar con Ingeniería #dato-faltante).
> Líneas del piloto Horacio: por definir con Pamela Ramírez #revisar.

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
