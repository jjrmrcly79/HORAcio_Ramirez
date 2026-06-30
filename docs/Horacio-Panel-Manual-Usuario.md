# Horacio — Manual del Panel (para Marco, Gaby y Jessica)
> Panel de captura · `https://n8n.nexiasoluciones.com.mx/webhook/horacio-panel?token=…`
> Versión 2026-06-29. Maquetas en texto (las flechas → indican dónde tocar). Si quieren capturas
> reales anotadas, mándenmelas con sesión iniciada y las marco.

---

## 0. Entrar (login con PIN)
```
┌───────────────────────────────┐
│  Inicia sesión                 │
│  Elige tu nombre y tu PIN.     │
│  ┌─────────────────────────┐   │
│  │ Marco Sotelo    admin   │ ← 1) toca tu nombre
│  │ Gabriela H.             │   │
│  │ Jessica J.              │   │
│  └─────────────────────────┘   │
│  PIN: [ • • • • ]           ← 2) escribe tu PIN → Entrar
└───────────────────────────────┘
```
> ¿Sin PIN? Un admin (Marco/Jorge) te lo asigna en **Personas / PIN**.

Arriba verás las pestañas (cambian según tu permiso):
`Captura en vivo · Registrar hora · Metas del día · Estándar · Tableros · Asignar líder · Paros · Personas`

---

## 1. Metas del día — fijar la meta (Marco / Gaby / Jessica)
**Para qué:** decirle a cada tablero cuánto debe producir por hora. Antes era solo por Telegram (`/orden`); ahora aquí.

```
┌── Metas del día — 2026-06-29 ─────────────────────────────────┐
│ SMT 520                                                       │
│  OT: [ 251203003-02 · TJ000222 (200 pend) ▼]  ← 1) elige la OT │
│  Meta/hr: [  93 ]   [💡 sugerir]  [guardar]                     │
│                       ▲ 2) toca: propone meta del estándar     │
│                                  ▲ 3) acepta o cámbiala         │
│                                            ▲ 4) guardar         │
└───────────────────────────────────────────────────────────────┘
```
**Pasos:** 1) elige la **OT del sistema** (ya viene la lista, no se teclea) → 2) **💡 sugerir**
(Horacio propone la meta desde el estándar) → 3) déjala o ajústala → 4) **guardar**.
> Si **cambias** la meta sugerida, te pide un **motivo** (queda registrado). Eso ayuda a corregir el estándar.

---

## 2. Estándar — capturar lo que falta (solo Gaby)
**Para qué:** llenar las piezas/hora por estación. Cuando una parte tiene su estándar, su meta sale sola.

```
┌── Capturar / editar estándar por hora ────────────────────────┐
│  Parte: [ ⚠ Sin estándar · de OT en proceso ▼]  ← 1) elige parte│
│  ┌──────────┬──────────┬──────────┬──────────┐                 │
│  │ P&P 520  │ Ensamble │ Conformal│ FCT      │                 │
│  │ [ 100 ]  │ [  85 ]  │ [   ]    │ [  60 ]  │ ← 2) escribe Std/Hr│
│  └──────────┴──────────┴──────────┴──────────┘                 │
│        ▲ se guarda al salir del campo · vacío = borra           │
└───────────────────────────────────────────────────────────────┘
```
**Pasos:** 1) elige la parte (las **⚠ de OT en proceso** son prioridad) → 2) escribe el Std/Hr de
cada estación. Se **guarda solo** al salir del campo.

---

## 3. Paros vivos — atender lo detenido
**Para qué:** ver de un vistazo qué está parado y desde hace cuánto (el reloj corre solo).

```
┌── Paros vivos — 2 abierto(s) ─────────────────────────────────┐
│ ▌ Ola 1 · PTH                                  ⏱ 01h 12m 40s   │ ← cronómetro vivo
│   Falta material · escalado a Marco              [ Cerrar ]    │
│ ▌ SMT 520 · SMT   (rojo = de día(s) anteriores) ⏱ 03h 05m     │
└───────────────────────────────────────────────────────────────┘
```
- El borde/reloj en **rojo** = lleva días sin cerrarse.
- **"escalado a"** = a quién se le avisó (dueño del rol del tablero).
- **Cerrar** cuando se resolvió.

---

## 4. Captura en vivo y Registrar hora (todas)
- **Captura en vivo:** matriz tablero × hora. Verde = lo capturó la líder, azul = manual, gris = sin
  dato. Toca una celda **vacía (+)** para registrar esa hora.
- **Registrar hora:** elige tablero + hora + piezas (+ causa/nota) → **Registrar**. Queda firmado con tu nombre.

---

## Reglas rápidas
- Todo lo que guardas queda **firmado con tu sesión** (quién y cuándo).
- La meta es **la misma** que ve el bot de Telegram — no hay dos caminos.
- Estándar = solo Gaby. Meta = Marco/Gaby/Jessica.
- ¿Algo raro? Cierra sesión (**salir**, arriba a la derecha) y vuelve a entrar.
