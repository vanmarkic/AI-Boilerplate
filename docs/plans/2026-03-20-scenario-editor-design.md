# Scenario Editor — Design

## Goal

Improve the existing Scenario Builder with non-destructive editing, better information architecture, and a chronological walkthrough view.

## Features

### 1. Non-Destructive Editing

- **Save as Copy** — clones scenario to a new DB record with title suffixed "(copy)". Uses new endpoint `POST /api/scenarios/{id}/clone`.
- **Export JSON** — client-side download of scenario (title, description, content) as a `.json` file.
- **Import JSON** — file picker loads a `.json` file into the editor as a new unsaved scenario.
- **Revert** — discards all unsaved changes, reloads last-saved state from DB.

### 2. Global View (Improved Layout)

Single scrollable page replacing the current form-based layout.

**Top bar:**
- Scenario title (editable inline)
- Description (collapsible below title)
- Action buttons: Save | Save as Copy | Export JSON | Import JSON | Revert
- View toggle: Global / Walkthrough

**Sticky sidebar navigation:**
- Roles (first — events and decisions reference roles)
- Events
- Issues
- Decisions
- Settings

**Section pattern (repeated for each entity type):**
- Section header with item count + "Add" button
- List of items as expandable cards
- Collapsed state: title + key info (event type, scheduled time, etc.)
- Expanded state: full edit form
- Cross-reference chips are clickable (e.g., event's "triggers: issue-1" scrolls to that issue)

### 3. Chronological Walkthrough

Read-only view for stepping through events in `scheduled_pt_ms` order.

- Toggle between Global / Walkthrough via top bar
- Single event card displayed at a time, full details, centered
- Bottom navigation: Previous | "Event 3 of 12 — 05:00" | Next
- No editing in walkthrough — read-only preview

## Data & API Changes

### ScenarioContent — New Field

```
default_event_duration_ms: float | None
```

Scenario-level default duration. Used when an event's own `duration_ms` is null. Applied at load time by `scenario_loader.py`.

### New API Endpoint

```
POST /api/scenarios/{id}/clone
```

Creates a copy of the scenario with title suffixed "(copy)". Returns the new `ScenarioResponse`.

### No Other Backend Changes

- JSON export/import is purely client-side (serialize/parse + browser download/file picker)
- Existing CRUD endpoints cover all other operations

## Out of Scope

- Phases (exist in data model but ignored in this iteration)
- Editing in walkthrough view
- Node/graph-based visual editor
- Cumulative state tracking in walkthrough
