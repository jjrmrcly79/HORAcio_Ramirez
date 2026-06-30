# Reunión — Subensambles SMT vs Tarjetas finales (flujo "víbora")
**Fecha:** 2026-06-26 · **Convoca:** Juan (NexIA) · **Para:** equipo de planeación / piso (Mapartel)
**Objetivo:** entender cómo se relacionan las cantidades de **SMT (subensamble)** y **PTH/final (tarjeta)**
para que el tablero "víbora" de Horacio cuente bien el material en proceso (WIP) y deje de marcar
**falsos atorones**.

---

## 1. Por qué importa (en una frase)

El tablero hoy compara, **por cada orden**, lo que SMT terminó contra lo que la tarjeta final terminó,
suponiendo que son **1 a 1**. Resulta que **en el 57.5% del volumen terminado** (118,749 de 206,499 pzs)
**no son 1 a 1** → el tablero muestra material "atorado" que en realidad ya fluyó. Necesitamos que el
equipo confirme la regla real para corregir el cálculo.

> **Cómo leer las OT:** `251200814-02` = subensamble **SMT**; `251200814-01` = tarjeta **final (PTH)**.
> Comparten la raíz `251200814`. "Term" = piezas terminadas según el ERP.

---

## 2. El caso que disparó la duda (referencia)

**Orden 251200814 — tarjeta 225D7291G006 (familia ANDROMEDA)**

| Partida | Qué es | Ordenado | Terminado | % | Status |
|---|---|---|---|---|---|
| `-02` SMT | Subensamble ANDROMEDA | **2000** | 2000 | 100% | Cerrada |
| `-01` PTH | Tarjeta final G006 | **1500** | 1500 | 100% | Cerrada |

Las dos cerraron al 100% de **su propia** cantidad. SMT hizo 2000, el final pidió 1500.
**Pregunta del piso:** ¿esas 500 piezas de más se fueron a otra orden? ¿se quedaron en inventario?
¿o es solo forma de contar?

---

## 3. Los 4 patrones que encontramos (con casos para validar)

### Patrón A — Ratio EXACTO y constante de 2:1 (¿panel o unidad de medida?)
Aquí SMT ordena **siempre el doble** que la tarjeta final, en **todas** sus órdenes. Sospecha:
SMT cuenta **paneles de 2 tarjetas** o pone **2 subensambles por tarjeta**.

**Subensamble `222D8835G004` → tarjeta `295D2290G004`** (6 de 6 órdenes en 2:1)

| Orden | SMT term | Final term | Ratio |
|---|---|---|---|
| 251201907 | 200 | 100 | 2.0 |
| 251202430 | 600 | 300 | 2.0 |
| 251202431 | 400 | 200 | 2.0 |
| 251202626 | 400 | 200 | 2.0 |

**Subensamble `FOCARIS_CTRL_[H]` → `295D2311G025`/`G027`** (11 de 11 en 2:1): 251201905 (200/100),
251202433 (400/200), 260101811 (200/100)…
**Subensamble `FOCARIS_DISP_[D]` → `295D2699G006`/`G007`** (8 de 8 en 2:1): 251202122 (240/120),
251202137 (230/115)…

> ❓ **Pregunta A:** ¿"200 SMT" y "100 finales" son la **misma cantidad física** (panel de 2 / 2 subens
> por tarjeta)? Si sí, ¿cuál es el número de subensambles por tarjeta para estos modelos?

---

### Patrón B — Subensamble COMÚN a varias tarjetas (pool compartido)
Un mismo tablero SMT se vuelve **varias tarjetas finales distintas**. El sobrante de una orden parece
alimentar a otra. Caso estrella: **ANDROMEDA → 6 finales** (G001, G005, G006, G007, G008, 225D7338G012).

**Evidencia de que se cruzan (mismo subensamble ANDROMEDA):**

| Orden | Tarjeta final | SMT term | Final term | Qué se ve |
|---|---|---|---|---|
| 251200814 | G006 | 2000 | 1500 | **+500 SMT de más** |
| 260300412 | G006 | 3000 | 1920 (en proc.) | SMT 3000 vs final 2026 ordenado |
| 260500601 | **G005** | 700 (de 1200) | 0 (de **2000**) | el final pide 2000, su SMT solo 1200 → **le falta**, ¿lo cubre el sobrante de otras? |
| 260101701 | 7338G012 | **0** | 160 | **final hecho con SMT propio = 0** |
| 260101702 | G008 | **0** | 640 | **final hecho con SMT propio = 0** |

> ❓ **Pregunta B1:** ¿El subensamble ANDROMEDA se fabrica "para todos" y luego se reparte entre las
> tarjetas G001/G005/G006/G007/G008? ¿O cada orden de SMT es para su tarjeta?
> ❓ **Pregunta B2:** ¿Hay **inventario de subensamble** entre órdenes (lo que sobra de una semana se usa
> en la siguiente)? Si sí, ¿dónde se registra?
> ❓ **Pregunta B3:** En 260101701 y 260101702 la tarjeta cerró con su SMT en 0 — **¿de dónde salió ese
> subensamble?** (de otra orden / de inventario)

---

### Patrón C — El ratio depende de la TARJETA, no del subensamble (clave para el modelo)
El **mismo** subensamble `FOCARIS_CTRL_[F]` rinde **distinto según el modelo final**:

| Tarjeta final | Ratio SMT:final | Ejemplos (orden · SMT/final) |
|---|---|---|
| `222D9519G025` | **1 : 1** | 251201908 (100/100) · 251202310 (300/300) · 260101804 (300/300) |
| `295D2311G030` | **2 : 1** | 251201906 (250/125) |
| `295D2311G024` | **2 : 1** | 251202316 (200/100) · 251202345 (200/100) |
| `295D2311G023` | **2 : 1** | 251202331 (400/200) |
| `295D2311G016` | **2 : 1** | 260101820 (120/60) |

> ❓ **Pregunta C:** ¿Por qué la misma placa SMT da 1 tarjeta para el G025 pero "2 SMT por tarjeta" para
> los 295D2311? ¿Es que los 295D2311 llevan **2 subensambles** cada uno, o el panel rinde distinto?
> **Esto nos dice que la regla correcta es por _(subensamble × modelo final)_, no por subensamble.**

---

### Patrón D — Sobre-producciones grandes y finales sin SMT propio
**Subensamble `SENSOR VELOCIDAD` → `253C1142P001`/`P003`** (66 mil pzs, el de mayor volumen). Casi todo
es 1:1, pero hay saltos grandes:

| Orden | Tarjeta | SMT term | Final term | Qué se ve |
|---|---|---|---|---|
| 251200812 | P003 | **12000** | 5900 | SMT más del doble que el final |
| 260101709 | P003 | 10000 | 5000 (Liberada) | 2:1 |
| 251201705 | P001 | **0** | 1200 | final cerrado, SMT propio en 0 |
| 260101712 | P003 | **0** | 5000 | final cerrado, SMT propio en 0 |
| 260101715 | P003 | **0** | 5000 | final cerrado, SMT propio en 0 |
| 260300403 | P003 | **0** | 5000 | final cerrado, SMT propio en 0 |

> ❓ **Pregunta D1:** ¿Por qué 12000 SMT para 5900 finales en 251200812? ¿buffer, panel, o alimentó a más?
> ❓ **Pregunta D2:** Varias tarjetas P003 cerraron 5000 pzs con su SMT en **0** — ¿se hicieron de un lote
> grande de SMT previo (251200812 / 251204403)? Confirmar el flujo real.

---

## 4. Qué necesitamos decidir en la reunión (checklist de salida)

Para arreglar el cálculo del WIP necesitamos salir con estas respuestas:

- [ ] **A. Factor subensambles-por-tarjeta (BOM)** para los modelos en 2:1 — ej. `295D2290G004 = 2 SMT`,
      `295D2311G024 = 2 SMT`, `295D2699G007 = 2 SMT`. ¿Hay una lista BOM oficial que podamos cargar?
- [ ] **B. ¿El subensamble común se pool-ea?** (ANDROMEDA, SENSOR VELOCIDAD, FOCARIS_*): ¿se reparte entre
      modelos y se guarda inventario entre órdenes? ¿Cómo se asigna a cada OT final?
- [ ] **C. Regla por modelo, no por subensamble** (caso FOCARIS_CTRL_[F]): confirmar que el factor va por
      tarjeta final.
- [ ] **D. Finales con SMT propio = 0:** confirmar que salieron de inventario / otra OT (no es error de captura).
- [ ] **E. Unidad de conteo de SMT:** ¿el ERP cuenta SMT en **paneles** o en **tarjetas individuales**?

> Con A–E definidos, el tablero podrá:
> 1. Comparar `SMT_terminado` vs `final_terminado × (subens por tarjeta)` → **adiós falsos 2:1**.
> 2. Agrupar el WIP de subensambles compartidos **a nivel subensamble** (no por orden) → **adiós falso
>    "500 atoradas" de la 251200814**.

---

## 5. Resumen ejecutivo (1 minuto)

- El tablero supone que **1 SMT = 1 tarjeta por orden**. **En la mayoría del volumen no es así.**
- Hay **3 razones** legítimas: (A) SMT se cuenta en **paneles/2 por tarjeta**; (B) el subensamble es
  **común a varios modelos** y se reparte; (C) el factor **depende del modelo final**.
- No es un error del dato ni del piso — es que **falta cargarle a Horacio la receta (BOM) y la regla de
  pool**. La reunión es para sacar esa receta con números que el equipo reconozca.

---

### Anexo 1 — Los 14 subensambles afectados (lista completa para repartir)
Subensambles SMT cuyo flujo **no es 1:1** con su tarjeta final (orden por volumen terminado).
`Balance = SMT_terminado − final_terminado` (positivo = SMT hizo de más; negativo = el final consumió más SMT
del que esas órdenes reportan → vino de otra orden/inventario).

| # | Subensamble SMT | Órdenes | Variantes finales | Tipo | SMT term | Final term | Balance |
|---|---|---|---|---|---|---|---|
| 1 | SENSOR VELOCIDAD | 16 | 2 (253C1142 P001/P003) | compartido | 66,100 | 66,996 | −896 |
| 2 | ANDROMEDA | 20 | 6 (225D7291 G001/G005/G006/G007/G008 · 225D7338G012) | compartido | 41,544 | 38,587 | +2,957 |
| 3 | 223C7947P004 | 15 | 2 (259C1035 G005/G006) | compartido | 3,882 | 4,377 | −495 |
| 4 | FOCARIS_CTRL_[F] | 19 | 5 (222D9519G025 · 295D2311 G016/G023/G024/G030) | compartido | 3,850 | 3,276 | +574 |
| 5 | STLTZ_TMP_P2_10 | 4 | 1 | ratio≠1 | 700 | 1,147 | −447 |
| 6 | 222D8835G004 | 6 | 1 (295D2290G004) | ratio 2:1 | 2,052 | 1,026 | +1,026 |
| 7 | FOCARIS_CTRL_[H] | 11 | 2 (295D2311 G025/G027) | ratio 2:1 | 2,000 | 1,000 | +1,000 |
| 8 | PSMEX | 4 | 2 (225D6423 G001/G002) | compartido | 578 | 784 | −206 |
| 9 | CENTAURO | 8 | 3 (189D5035 G001/G002 · 234D2417G002) | compartido | 646 | 662 | −16 |
| 10 | FOCARIS_DISP_[D] | 8 | 2 (295D2699 G006/G007) | ratio 2:1 | 1,189 | 534 | +655 |
| 11 | 295D3972G001_ASM | 3 | 1 (259C1482G003) | ratio≠1 | 600 | 200 | +400 |
| 12 | FOCARIS_CTRL_[I] | 3 | 2 (295D2311 G026/G028) | compartido | 200 | 100 | +100 |
| 13 | FOCARIS_CTRL_[G] | 1 | 1 (295D2311G007) | ratio 2:1 | 120 | 60 | +60 |
| 14 | 295D3972G001 | 1 | 1 | ratio≠1 | 16 | 0 | +16 |

**Patrón notorio:** toda la familia **FOCARIS** (controles y display) aparece — fuerte indicio de panel/2-up
o BOM de 2 subensambles por tarjeta en los modelos 295D2311 / 295D2699.

---

### Anexo — glosario rápido
- **Subensamble SMT** = la placa que sale de SMT (partida `-02`/`-03`).
- **Tarjeta final / PTH** = el producto terminado (partida `-01`).
- **WIP** = material en proceso (lo que SMT ya hizo pero el final aún no consume).
- **Ratio SMT:final** = cuántas piezas de SMT por cada tarjeta final (1:1, 2:1…).
- **Pool / compartido** = un subensamble que alimenta a más de un modelo final.
