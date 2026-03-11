# Product Specification

<!--
  This file tells LLM agents WHAT the software does.
  AGENTS.md tells them HOW to write code — this tells them WHY and WHAT.

  Fill every section before starting implementation.
  Update whenever you add a feature or change business rules.
  Stale specs are worse than no specs.
-->

## What This Is

<!-- 1-2 paragraphs answering: What domain? Who are the users? What problem does it solve? -->

## Domain Model

<!-- Entity-relationship overview. Use ASCII diagrams. -->

## Features & Business Rules

<!-- One subsection per feature. Example: -->

### Feature: incidents (tier 2, backend + frontend)

- **Purpose:** Track and visualize technical incidents with timeline and histogram view for incident management and analysis.
- **Rules:**
  - Incidents have a title, description, severity level (critical, high, medium, low), start time, and optional end time
  - Incidents can be created by authorized users
  - Incidents can be filtered by severity, date range, and status (ongoing, resolved)
  - Timeline view shows incidents chronologically with histogram aggregation by time period
- **User stories:**
  - As an operations engineer, I want to view a timeline of incidents so that I can track when issues occurred
  - As a team lead, I want to see a histogram of incidents grouped by time period so that I can identify patterns
- **API:**
  - `POST /api/incidents` — Create a new incident
  - `GET /api/incidents` — List incidents with optional filters (severity, date_from, date_to, status)
  - `GET /api/incidents/:id` — Get incident details
  - `PATCH /api/incidents/:id` — Update incident
  - `GET /api/incidents/timeline/histogram` — Get histogram data for timeline visualization

## Glossary

<!-- Domain-specific terms the LLM should use consistently in naming. -->

| Term | Definition |
|------|-----------|
