# Product Specification

<!--
  This file tells LLM agents WHAT the software does.
  AGENTS.md tells them HOW to write code — this tells them WHY and WHAT.

  Fill every section before starting implementation.
  Update whenever you add a feature or change business rules.
  Stale specs are worse than no specs.
-->

## What This Is

AI Boilerplate is a full-stack application for monitoring and visualizing technical events. It provides real-time dashboards, historical analysis, and alerting for distributed systems and applications. Users can track deployments, errors, performance metrics, and other technical events across their infrastructure.

## Domain Model

```
User
  ├── Event (created_by)
  │   ├── event_type (deployment, error, metric, alert)
  │   ├── timestamp
  │   ├── severity
  │   └── metadata (JSON)
  │
  └── Dashboard
      └── EventTimeline (displays events)
```

**Core Entities:**
- **Event:** Atomic record of something that happened in the system (deployment, error, metric spike, etc.)
- **EventType:** Category of event (deployment, error, metric, alert)
- **Severity:** Impact level (info, warning, error, critical)
- **Timestamp:** UTC timestamp when event occurred

## Features & Business Rules

<!-- One subsection per feature. Example: -->

### Feature: event (tier 2, backend + frontend)

- **Purpose:** Record, retrieve, and visualize technical events in a dense histogram timeline.
- **Rules:**
  - Events must have a timestamp, type, and severity level
  - Event types: `deployment`, `error`, `metric`, `alert`
  - Severity levels: `info`, `warning`, `error`, `critical`
  - Timestamps are UTC and immutable once created
  - Timeline can aggregate up to 720 bars (e.g., 12 hours @ 1-minute intervals)
  - Events are keyed by creator user ID
- **User stories:**
  - As an engineer, I want to see all events for a time window so that I can understand system behavior.
  - As an operator, I want to view a dense histogram timeline of events so that I can spot patterns and anomalies.
  - As a developer, I want to programmatically create events so that I can track deployments, errors, and metrics.
- **API:**
  - `POST /api/events` — Create a new event
  - `GET /api/events/:id` — Get event details
  - `GET /api/events?type=deployment&severity=error&start_time=...&end_time=...` — Query events by filter
  - `GET /api/events/timeline?start_time=...&end_time=...&bucket_size=60` — Get aggregated event counts for histogram

## Glossary

<!-- Domain-specific terms the LLM should use consistently in naming. -->

| Term | Definition |
|------|-----------|
| **Event** | Atomic record of something that occurred in the system (e.g., deployment, error spike, alert). Immutable once created. |
| **Event Type** | Category of event: `deployment`, `error`, `metric`, `alert`. |
| **Severity** | Impact level: `info` (informational), `warning`, `error`, `critical`. |
| **Histogram Timeline** | Dense, visual representation of event density over time. Each bar represents event count in a time bucket. |
| **Bucket** | Time interval for aggregating events (e.g., 60 seconds). Used in histogram calculations. |
| **Time Window** | Start and end timestamps (UTC) defining the query range. |
