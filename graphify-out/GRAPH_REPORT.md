# Graph Report - .  (2026-06-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 100 nodes · 149 edges · 11 communities (10 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5bf35701`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Order Management|Order Management]]
- [[_COMMUNITY_Session Handling|Session Handling]]
- [[_COMMUNITY_Workflow Management|Workflow Management]]
- [[_COMMUNITY_Insight Management|Insight Management]]
- [[_COMMUNITY_Motivation Tools|Motivation Tools]]
- [[_COMMUNITY_Horacio Bot Integration|Horacio Bot Integration]]
- [[_COMMUNITY_Step Management|Step Management]]
- [[_COMMUNITY_Code Push|Code Push]]
- [[_COMMUNITY_Board Management|Board Management]]

## God Nodes (most connected - your core abstractions)
1. `pg()` - 15 edges
2. `tg()` - 15 edges
3. `esc()` - 9 edges
4. `setSess()` - 7 edges
5. `Horacio (bot HxH Mapartel · SN-04 v2)` - 7 edges
6. `startFlowWithBoard()` - 6 edges
7. `motivar()` - 5 edges
8. `closeParo()` - 5 edges
9. `askLine()` - 4 edges
10. `guardarInsight()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `Horacio (bot HxH Mapartel · SN-04 v2)` --uses--> `Claude (IA para Horacio)`  [EXTRACTED]
  AGENTS.md → CLAUDE.md
- `Horacio (bot HxH Mapartel · SN-04 v2)` --references--> `Catálogo de Causas de Paro (Horacio)`  [EXTRACTED]
  AGENTS.md → Horacio - Catalogo Causas de Paro.md
- `Horacio (bot HxH Mapartel · SN-04 v2)` --references--> `Catálogo de Líneas y Estándares (Horacio)`  [EXTRACTED]
  AGENTS.md → Horacio - Catalogo Lineas y Estandares.md
- `Horacio (bot HxH Mapartel · SN-04 v2)` --references--> `Escalamiento y SLAs (Horacio)`  [EXTRACTED]
  AGENTS.md → Horacio - Escalamiento y SLAs.md
- `Horacio (bot HxH Mapartel · SN-04 v2)` --references--> `Guía de Uso e Instructivo (Horacio)`  [EXTRACTED]
  AGENTS.md → Horacio - Guia de Uso e Instructivo.md

## Import Cycles
- None detected.

## Communities (11 total, 1 thin omitted)

### Community 0 - "Order Management"
Cohesion: 0.09
Nodes (22): areaLeader, AREAS, buildPareto(), conMeta, embarques, escal, expectedSlots, fecha (+14 more)

### Community 1 - "Session Handling"
Cohesion: 0.16
Nodes (13): esc(), fecha, getSession(), newSession(), now, nowMX(), pad2(), PAGE (+5 more)

### Community 2 - "Workflow Management"
Cohesion: 0.31
Nodes (11): askLine(), boardsByPid(), closeParo(), esc(), ordenMenu(), perfilCtx(), pg(), readSess() (+3 more)

### Community 3 - "Insight Management"
Cohesion: 0.28
Nodes (6): guardarInsight(), OPEN, pad2(), pgh, resumirInsight(), winClose()

### Community 4 - "Motivation Tools"
Cohesion: 0.25
Nodes (9): askArea(), escalarRH(), hxhBoardMenu(), menu(), motivar(), rmKb(), tg(), tgRaw() (+1 more)

### Community 5 - "Horacio Bot Integration"
Cohesion: 0.25
Nodes (8): Horacio (bot HxH Mapartel · SN-04 v2), Claude (IA para Horacio), Catálogo de Causas de Paro (Horacio), Catálogo de Líneas y Estándares (Horacio), Escalamiento y SLAs (Horacio), Guía de Uso e Instructivo (Horacio), Organigrama General (Horacio), System Prompt (SN-04 v2) para Horacio

### Community 6 - "Step Management"
Cohesion: 0.47
Nodes (4): pg(), pgh, readSess(), setStep()

### Community 9 - "Code Push"
Cohesion: 0.83
Nodes (3): find_n8n(), load_secrets(), main()

## Knowledge Gaps
- **33 isolated node(s):** `pgh`, `OPEN`, `pgh`, `fecha`, `horaNum` (+28 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `tg()` connect `Motivation Tools` to `Board Management`, `Workflow Management`, `Insight Management`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `pg()` connect `Workflow Management` to `Board Management`, `Insight Management`, `Motivation Tools`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `pgh`, `OPEN`, `pgh` to the rest of the system?**
  _33 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Order Management` be split into smaller, more focused modules?**
  _Cohesion score 0.08666666666666667 - nodes in this community are weakly interconnected._