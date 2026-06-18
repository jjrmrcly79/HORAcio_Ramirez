# Horacio — Guía de Uso e Instructivo
> Cómo funciona Horacio de punta a punta, los flujos desde Telegram, y un guion
> sugerido para grabar videos explicativos. Pensado para capacitar al piso, a
> supervisión y a Dirección de Mapartel.
>
> Documento de apoyo (humano). La fuente de verdad técnica es `AGENTS.md` y las
> tablas `horacio.*`. Versión: 2026-06-18.

---

## 1. ¿Qué es Horacio? (en una frase)

**Horacio Ramírez** es un compañero de trabajo digital (un bot de Telegram) que
lleva el **Hora por Hora** del piso: cada hora les pregunta a las líderes cómo van,
recibe los paros/faltantes/calidad, **avisa al responsable** para que reaccione,
**motiva** cuando van bien, y al final del día **resume** para Dirección y **pregunta
cómo se sintieron**. No regaña, no compara líneas: *da antes de pedir*.

---

## 2. Mapa general (la arquitectura, sin tecnicismos)

```
        ┌──────────────────────── TELEGRAM ────────────────────────┐
        │  Líderes · Dueños de reacción · Daniel · Dirección · RH    │
        └───────────────▲───────────────────────────┬───────────────┘
                        │ mensajes / botones         │ avisos
                        │                            ▼
                 ┌──────┴───────────────────────────────────┐
                 │   n8n  (el "cerebro", 3 flujos)           │
                 │   • Bot      — atiende cada mensaje       │
                 │   • Scheduler— dispara la rutina del día  │
                 │   • Dashboard— sirve las páginas web      │
                 └──────┬───────────────────────────────────┘
                        │ guarda / lee
                        ▼
                 ┌──────────────────────┐      ┌────────────────────┐
                 │  Supabase (base de    │      │  Claude Haiku (IA) │
                 │  datos · horacio.*)   │      │  plática de salida │
                 └──────────────────────┘      └────────────────────┘
                        ▲
        ┌───────────────┴───────────────┐
        │  2 páginas web (navegador)     │
        │  • Dashboard  → Dirección      │
        │  • Panel      → supervisión    │
        └───────────────────────────────┘
```

**En palabras:** todo entra y sale por **Telegram**. Atrás, **n8n** decide qué hacer
y guarda/lee en **Supabase**. Hay **2 páginas web** (Dashboard para Dirección, Panel
para supervisión) y la **IA (Claude Haiku)** solo se usa para la plática de la
encuesta de salida.

---

## 2.1 La arquitectura contada como personas

Imagina que Horacio no es un "sistema", sino un **equipo de compañeros** que trabajan
juntos. Cada pieza técnica es una persona con un oficio:

| "Persona" | En lo técnico es… | Su oficio |
|---|---|---|
| 🧑‍🏭 **Horacio** | el bot (n8n) | El compañero que habla con todos por Telegram. |
| ⏰ **El Relojero** | el Scheduler (crons) | Vigila el reloj y le avisa a Horacio "ya es hora". |
| 📒 **El Archivista** | Supabase (base de datos) | Apunta todo en su libreta y nunca olvida (con quién, qué, cuándo). |
| 📣 **El Vocero** | el Dashboard | Le muestra el panorama a Dirección. |
| 🧰 **El de Piso** | el Panel | Supervisión: registra lo que faltó y corrige (dejando rastro). |
| 🧠 **El Consejero** | Claude Haiku (IA) | Escucha a la líder al final del día. |
| 👩‍🔧 **El Operador / La Líder** | persona real | Captura su Hora por Hora. |
| 🔧 **Los Reaccionadores** | Daniel · Nayeli · Marco · JC | Resuelven paros / faltantes / calidad. |

### La escena de cada hora (el relevo de la captura)

```
  :35 en punto…

  ⏰ El Relojero  ─►  "Horacio, ya son las :35. Pregúntales."
                          │
                          ▼
  🧑‍🏭 Horacio  ─►  (le escribe al Operador por Telegram)
        "¿Cómo vamos? Hora por hora de 07:30-08:30 — toca tu tablero 👇"
                          │
                          ▼
  👩‍🔧 El Operador  ─►  toca un botón:  ✅ Sí   ·   ❌ Faltó (+causa)   ·   "120 piezas"
                          │
                          ▼
  🧑‍🏭 Horacio  ─►  📒 El Archivista:  "Apunta: SMT 520 · 07:30-08:30 · 120 pzs · lo dijo ella."
                          │
        ┌─────────────────┼──────────────────────────┐
        ▼                 ▼                           ▼
  📣 El Vocero        🧑‍🏭 Horacio                  (queda guardado
  ya lo muestra       "¡Vas bien! 🙌" (si cruzó      para el resumen
  a Dirección          un hito, lo felicita)          del día)
```

**En una frase:**
> Cada hora, el **Relojero** le recuerda a **Horacio**; Horacio le pregunta al **Operador**;
> el Operador contesta con **un toque**; Horacio corre a anotarlo con el **Archivista**; y el
> **Vocero** lo enseña en el tablero. Si algo se cae, Horacio va por un **Reaccionador**.

### ¿Y si el Operador no contesta?
```
  :50  🧑‍🏭 Horacio  ─►  "Cuando puedas, aún falta tu hora por hora 🙏"
  :58  🧑‍🏭 Horacio  ─►  (a su jefe)  "Falta la captura de esta línea, ¿le echas la mano?"
```

### ¿Y si hay un problema?
```
  👩‍🔧 Operador  ─►  🛑 "Se paró por falla de máquina"
                          │
  🧑‍🏭 Horacio  ─►  🔧 Reaccionador (JC):  "Paro en SMT por máquina. Acúsalo."
                          │
  🔧 JC  ─►  "Visto 👍"  ─►  Horacio: "¿Qué acción tomas?"  ─►  JC la escribe
                          │
  👩‍🔧 Operador  ─►  "✅ Ya quedó"  ─►  Horacio: "¿cuántos minutos duró?"  ─►  se cierra
```

### Al cerrar el día
```
  ⏰ Relojero (18:00)  ─►  🧑‍🏭 Horacio  ─►  👩‍🔧 Operador:  "¿cómo te sentiste hoy? 😀/😐/😟"
                                    │
                                    ▼
  🧑‍🏭 Horacio  ↔  🧠 El Consejero (IA):  lo escucha, lo contiene; si fue pesado, avisa a RH.
```

> 💡 *Tip para video:* esta sección es prácticamente un **guion con personajes** — sirve
> para animar el relevo de la captura (el Relojero pasa el mensaje a Horacio, Horacio al
> Operador, y de vuelta al Archivista).

---

## 3. Los actores (quién usa qué)

| Actor | Cómo entra | Qué hace |
|---|---|---|
| **Líder de línea** (Viri, Yadira, Rocío, Brenda) | Telegram | Reporta su Hora por Hora, paros, faltantes, calidad. Recibe motivación y la encuesta. |
| **Dueño de reacción** (Daniel, Nayeli, Marco, JC) | Telegram | Recibe el aviso del paro/faltante/calidad, lo acusa ("Visto") y escribe la **acción**. |
| **Producción** (Daniel) | Telegram `/orden` | Fija OT + modelo + meta por tablero. |
| **Supervisión / admin** | **Panel** (web, con PIN) | Ve la captura en vivo, registra horas faltantes, corrige, da de alta tableros y asigna líderes. |
| **Dirección** (Jorge) | **Dashboard** (web) + resumen 17:00 | Ve KPIs, semáforos y tendencia. Sin nombres de operadoras. |
| **RH** (Ivonne) | Telegram | Recibe el aviso cuando una líder terminó el día "pesada". |

---

## 4. La rutina del día (línea de tiempo · L–V)

Estos disparos son automáticos (el **Scheduler** de n8n, horario de México):

```
06:45  Horacio le recuerda a Daniel definir las órdenes del día (/orden)
07:35  PING — pregunta el Hora por Hora de la 1ª ventana (06:30–07:30)
07:50  Recordatorio a quien no ha subido
07:58  Si sigue sin subir → avisa a su jefe (Producción / Embarques)
  ⋮    (ping :35, recordatorio :50, escala :58 se repiten cada hora hasta las 15:xx)
15:40  Resumen del día a cada líder (lo suyo)
17:00  Resumen ejecutivo a Dirección
18:00  Encuesta de salida: "¿cómo estuvo tu día?" + plática con Horacio
```

> **Ventanas HxH:** el turno es 6:30–15:30 → **9 ventanas** de :30 a :30
> (06:30-07:30, 07:30-08:30, … 14:30-15:30).

---

## 5. Flujos paso a paso (para el instructivo)

### 5.1 Darse de alta — `/start`
1. La persona abre el chat con **@HoracioRamirez_bot** y escribe **`/start`**.
2. Horacio pregunta **"¿qué llevas a tu cargo?"**:
   - **📋 Una línea de producción** → elige su tablero (queda como líder).
   - **🔔 Un área de apoyo** → Paros (Daniel) · Materiales (Nayeli) · Calidad (Marco)
     · Mantenimiento (JC) · Dirección (Jorge) · **🤝 Recursos Humanos (Ivonne)** ·
     📊 Solo recibir resumen.
3. Listo: a partir de ahí Horacio le habla con su nombre.

> 💡 *Tip para video:* mostrar que cualquiera empieza con `/start` — el bot guía solo.

### 5.2 Hora por Hora (el corazón) — llega solo cada hora
1. A los **:35** llega el ping: *"¿Cómo vamos, Yadira? Hora por hora de 07:30-08:30 —
   toca cada tablero:"* con **un botón por tablero**.
2. La líder toca un tablero. Según el tablero:
   - **Con meta (OT):** *"¿salió la meta (80)?"* → **✅ Sí** o **❌ Faltó**.
     - Si ❌ → elige cuántas faltaron y la **causa**.
   - **Sin meta:** *"¿cuántas piezas?"* → escribe el número.
   - **Embarques (Brenda):** elige **tarjeta** del catálogo + **cuántas**, repite, y
     **✔️ Cerrar la hora** (varias tarjetas por hora).
3. Cuando termina todos sus tableros: *"¡Listo! Quedó tu hora por hora 🙌"*.

> 💡 *Tip:* la líder **no escribe comandos** para el HxH — solo toca botones.

### 5.3 Reportar un paro — `/menu`
1. La líder escribe **`/menu`** → **🛑 Reportar paro**.
2. (Si lleva varios tableros) elige en cuál → elige la **causa**.
3. Horacio **avisa al dueño** (p. ej. Mantenimiento/JC) con botón **"Visto 👍"**.
4. El dueño toca **Visto** → Horacio le pregunta **"¿qué acción vas a tomar?"** →
   el dueño escribe la acción (inmediata + correctiva). Se **guarda** y se le avisa a la líder.
5. Cuando se resuelve, la líder toca **"✅ Ya quedó"** → Horacio pregunta **cuántos
   minutos duró** (botones 15/30/45/60/90/120 o "Otro") → guarda la **duración real**.

> 💡 *Por qué la duración se pregunta:* para que no se infle el dato si se cierra tarde.

### 5.4 Faltante de material / Calidad — `/menu`
- **📦 Falta material** → escribe el número de parte **o manda foto** de la etiqueta →
  se escala a **Nayeli** con botones [Visto][Surtido].
- **🔎 Reportar calidad** → describe qué pasó → se escala a **Marco**.

### 5.5 Definir las órdenes del día — `/orden` (solo Daniel)
1. Daniel escribe **`/orden`** → ve **un botón por tablero** (✅ los que ya tienen orden).
2. Toca un tablero → escribe la **OT** → escribe el **modelo / tarjeta** (o "-") →
   escribe la **meta por hora**.
3. Esa meta se vuelve el plan del día de ese tablero → ahora ese tablero pregunta ✅/❌
   y entra al **% de cumplimiento**.
   - *Conformal* corre 2 modelos a la vez → son **Conformal 1** y **Conformal 2**, cada
     uno con su OT/modelo/meta.

### 5.6 Motivación (Horacio "da antes de pedir") — automático
A medida que la líder captura, Horacio le manda un mensaje cálido al cruzar:
**inicio** (su 1ª captura), **mitad** (50% del día) y **completo** (100%). Una vez al día.

### 5.7 Encuesta de salida + plática con Horacio — 18:00
1. A las **18:00** Horacio pregunta: *"¿cómo estuvo tu día?"* → **😀 / 😐 / 😟**.
2. Luego: *"¿algo que quieras contarme?"* → la líder escribe (o "no").
3. Si escribe algo, **Horacio conversa** (con IA, cálido y breve, la escucha). Botón
   **"✅ Cerrar la plática"** cuando quiera.
4. Si el día fue **"pesado"**, al cerrar Horacio **avisa a RH (Ivonne)** para que le dé
   seguimiento — **sin compartir lo que platicaron** (privacidad).

---

## 6. Las páginas web

### 6.1 Dashboard (Dirección) — solo lectura, sin nombres
`https://n8n.nexiasoluciones.com.mx/webhook/horacio-dash?token=<DASH_TOKEN>`
- **KPIs del día** (toca cada uno y te explica qué mide): Cumplimiento, Tableros
  reportando, Paros, Tiempo de reacción, Faltantes, Calidad.
- **Cumplimiento por tablero** con semáforo 🟢🟡🔴 (cada proceso cuenta **máx. 100%**;
  los que reportan >115% se marcan ⚠️ **"revisar meta/captura"**).
- **¿Quién sube info?** (avance X/45 del día), **escalamientos abiertos**, **Real vs
  Plan por hora**, **Pareto de causas**, **📦 Embarques por tarjeta**, y **Cumplimiento
  por día (semana)** para la junta.

### 6.2 Panel de captura (supervisión) — con **login por PIN**
`https://n8n.nexiasoluciones.com.mx/webhook/horacio-panel?token=<PANEL_TOKEN>`
1. **Entrar:** elige tu nombre + escribe tu **PIN** (el 1er admin lo crea; luego un admin
   asigna a los demás en "Personas / PIN").
2. **Captura en vivo:** matriz **tablero × hora** (verde = de líder, azul = manual,
   gris = sin dato, punteado = falta).
3. **Registrar hora:** mete a mano una hora que no se capturó (queda firmada con tu nombre).
4. **Corregir** (admin): toca una celda ya capturada → "✏️ Corregir" → nuevo valor + motivo.
   **No borra**: queda el registro original para auditoría (anti-falseo).
5. **Tableros / Asignar líder / Personas-PIN:** alta y edición desde el panel.

---

## 7. Cómo "se cierra" el ciclo (el loop completo)

```
   Daniel fija órdenes (06:45)
            │
            ▼
   Horacio pinguea cada hora ──► la líder captura (botones)
            │                          │
            │ si no captura            │ si hay problema
            ▼                          ▼
   recordatorio → escala al jefe   paro/faltante/calidad
                                       │
                                       ▼
                            el dueño acusa (Visto) + ACCIÓN ──► se resuelve (duración real)
            │
            ▼
   15:40 resumen a la líder · 17:00 resumen a Dirección
            │
            ▼
   18:00 encuesta de salida + plática (IA) ──► si "pesado" → RH
```

Cada hora **se cierra sola**: lo capturado queda; lo no capturado se marca y escala;
los problemas se acusan, se actúan y se cierran con su duración; y el día termina con
los resúmenes y el "¿cómo te sentiste?".

---

## 8. Guion sugerido para videos (cortos, 1–2 min c/u)

| # | Video | Para quién | Qué mostrar |
|---|---|---|---|
| 1 | **Conoce a Horacio** | Todos | Quién es, qué hace, el tono (da antes de pedir). |
| 2 | **Date de alta** (`/start`) | Líderes y dueños | Elegir línea o área; quedar registrado. |
| 3 | **Tu Hora por Hora** | Líderes | El ping :35, ✅/❌ o número, completar tus tableros. |
| 4 | **Embarques por tarjeta** | Brenda | Catálogo de tarjetas + cantidad + cerrar la hora. |
| 5 | **Reportar un paro** | Líderes + dueños | `/menu` → paro → Visto → acción → ya quedó → duración. |
| 6 | **Faltante y calidad** | Líderes | Foto de etiqueta; describir calidad. |
| 7 | **Órdenes del día** (`/orden`) | Daniel | OT + modelo + meta; Conformal 1 y 2. |
| 8 | **Encuesta de salida** | Líderes | Mood + platicar con Horacio; privacidad. |
| 9 | **El Dashboard** | Dirección | KPIs (tocar para explicación), semáforos, semanal. |
| 10 | **El Panel** | Supervisión | Login PIN, matriz, registrar, **corregir**, asignar. |

> Sugerencia de grabación: usar el **chat de prueba** (espejo de validación) para
> mostrar los flujos sin tocar al piso real.

---

## 9. Comandos rápidos (cheat sheet)

| Comando | Quién | Para qué |
|---|---|---|
| `/start` | Todos | Darse de alta (línea o área). |
| `/menu` | Líderes | Reportar paro / faltante / calidad. |
| `/orden` | Daniel | Fijar OT + modelo + meta por tablero. |
| `/ping` | Líderes | Pedir manualmente la botonera del Hora por Hora. |
| *(botones)* | Líderes/dueños | Todo el HxH y los acuses son por botón, sin escribir comandos. |

---

## 10. Privacidad (regla de oro)

- Los **resúmenes a Dirección** y el **Dashboard** llevan **líneas/tableros, nunca
  nombres de operadoras**.
- El **feedback de la encuesta** es para **RH/NexIA**, no para Dirección, y la **plática
  con Horacio no se comparte** (a RH solo le llega "tuvo un día pesado, dale seguimiento").
- El **Panel** (que sí ve nombres de líderes) se comparte **solo con supervisión** y va
  protegido con **token + PIN**.
