# Horacio — Insumos para el WIP exacto (Nayeli y Brenda)

> **Fecha:** 2026-07-01 · **De:** NexIA (Juan) · **Para:** Nayeli (Planeación) y Brenda (Producción/Inventario)
> **Contexto:** El pareo SMT↔final quedó **cerrado al 100%** del volumen en proceso. Ya arrancamos el
> tablero de **material en proceso (WIP) por subensamble**. Nos faltan **2 datos** para que el WIP deje
> de mostrar "más o menos" y sea **exacto**. Aquí van, cortitos.

---

## Cómo se ve hoy el WIP (para que se entienda la pregunta)

El tablero agrupa, por **subensamble SMT**, lo que SMT terminó contra lo que sus finales consumieron:

- **ANDROMEDA:** 3,280 SMT vs 3,944 finales → **0 atorado** ✅ (los finales jalaron un poco del buffer).
- **BLE COMM 2:** 1,620 SMT vs 1,925 finales → **0** ✅.

Eso ya está bien. El problema son **dos cosas** que el sistema todavía no sabe:

---

## 1. Para NAYELI — Subensambles con SMT hecho pero **sin finales** en el tablero

Marcaste estos como subensamble SMT ("es sub"), pero **no tienen finales pareados/en proceso**, así que
el tablero los muestra con **todo su SMT como "en proceso"** (no sabe a qué final se fueron). El más
llamativo: **TJ000360 con 16,063 piezas de SMT**.

**Pregunta:** de esta lista, ¿sus finales **no están corriendo ahorita** (es buffer real que espera su
orden final), o **faltan parear** (su tarjeta final sí existe y hay que ligarla)?

| Subensamble | Descripción | SMT terminado |
|---|---|---|
| TJ000360 | SMT TARJETA TJ000360 CIL 3 1V4, SOFTEL | 16,063 |
| TJ000363 | SMT TARJETA TJ000363 CIL 3 1V4, SOFTEL | 3,884 |
| TJ000255 | SMT TARJETA TJ000255 CIR WIRLESS 3V2 | 3,084 |
| TJ000362 | SMT TARJETA TJ000362 CIL 3 1V4 | 1,000 |
| 295D3972G001 | Ensamble Kit Wifi Cocinado | 185 |
| 222D5197G001 | TARJETA FUENTE DE PODER HORNO 80 | 100 |
| 05-1829-B1 | SMT TARJETA UNILUX LED BAYONNE | 99 |
| T0058770007 | TARJETA SMT WE 1 DISPLAY | 72 |
| TJ000254 · TJ000361 · 222D5197G002 · 05-1820-D5 | (sin avance aún) | 0 |

> Si a alguna le falta parear su final, se hace en **el panel → tab Pareo SMT** (igual que antes).

---

## 2. Para BRENDA — Los 2 datos que faltan para el WIP exacto

### 2a. Factor de cantidad (¿paneles / 2-up?)
En varios modelos, **SMT ordena el doble** que la tarjeta final (ej. 200 SMT → 100 finales). Necesitamos
saber si eso es porque **el SMT se cuenta en paneles de 2 tarjetas** (o van 2 subensambles por tarjeta).

**Pregunta:** ¿el SMT se cuenta en **paneles** o en **tarjetas individuales**? Y en los modelos que van
2:1, ¿cuántos subensambles SMT por tarjeta final?

### 2b. Stock de seguridad por subensamble (tu Excel)
Cuando liberas SMT **de más** (ej. 2,000 SMT para 1,500 finales), ese excedente queda como **semiterminado
en burbuja** en el área SMT (lo inventarías en tu Excel). El tablero necesita ese número para **separar el
buffer planeado del atoro real** — hoy los mezcla.

**Pregunta:** ¿nos puedes pasar tu Excel de **stock de seguridad / semiterminado por subensamble** (o el
objetivo por modelo)? Con eso el tablero pinta en rojo **solo lo atorado de verdad**, no el buffer.

---

## Qué desbloquea esto

Con (1) los finales de Nayeli, (2a) el factor de cantidad y (2b) el stock de seguridad de Brenda, el
tablero pasa de **"directional"** a **WIP exacto**: sabremos con número fino **dónde se atora de verdad**
el material entre SMT y el producto terminado.

Gracias — cualquier duda, me dicen. — Juan / NexIA
