# TFC Remaining Tasks

**Date:** 2026-03-16
**Status:** Backlog

---

## P2 — Important but not blocking

- [ ] GM: pause/resume individual events (not just the whole exercise)
- [ ] GM: delay or skip scheduled events
- [ ] Role-based decision targeting (send decisions to specific roles/participants, not broadcast)
- [ ] Decision timeout (auto-close decisions after a configurable duration)
- [ ] Auto-resolve countdown displayed in real time on active issues (engine timer works, frontend doesn't show it ticking)
- [ ] Session persistence across WebSocket reconnect (currently loses state on disconnect)
- [ ] Scenario builder: full CRUD for events, issues, decisions (currently placeholder view)
- [ ] Join view: session code + role assignment (currently placeholder)
- [ ] Review view: post-exercise timeline replay (currently placeholder)

## P3 — Nice to have

- [ ] Scoring hidden during execution, revealed in review
- [ ] Post-exercise evaluation / AAR (After Action Review) workflow
- [ ] Audit trail export (CSV/JSON)
- [ ] Event timeline with parallel lanes visualization
- [ ] Multi-domain theming beyond CSS custom properties (domain-specific terminology swaps)
- [ ] Participant presence indicators (who's connected)
- [ ] Chat/messaging between GM and players
- [ ] Exercise templates (save/load scenario configurations)

## Completed (reference)

- [x] Monorepo restructure (`apps/main`, `apps/tfc`, `packages/tfc-shared`)
- [x] TFC backend: FastAPI with exercise engine, scenarios, decisions, WebSocket, audit trail
- [x] TFC frontend: Angular app with GM view, Player view, routing shell
- [x] Exercise engine: TimeManager, EventScheduler, IssueManager, DecisionManager
- [x] Decision flow: auto-pause engine, modal overlay for players, GM observe/close
- [x] Scenario loader with context/briefing/objectives/rules
- [x] Component ownership: `packages/ui` = generic only, TFC-specific in `apps/tfc/shared`
- [x] Renamed domain-specific `etbol` to generic `auto_resolve_ms`
- [x] All P1 items (engine, decisions, WebSocket, GM view, Player view, scenario loader)
