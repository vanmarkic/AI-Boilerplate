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

### Feature: orders (tier 2, backend + frontend)

- **Purpose:** Order placement and tracking.
- **Rules:**
  - Minimum order value: $5.00
  - Order status transitions: pending → paid → shipped → delivered
  - Refunds allowed within 30 days of delivery
- **User stories:**
  - As a buyer, I want to place an order so that I receive my items.
- **API:**
  - `POST /api/orders` — Place a new order
  - `GET /api/orders/:id` — Get order details

## TFC Terminology Mapping (Domain ↔ Code)

The TFC codebase uses generic code names for domain concepts. The table below maps **domain language** (what users and exercise facilitators say) to **code names** (what appears in source files).

| Domain Term | Code Term | Description |
|-------------|-----------|-------------|
| **Inject** | `Event` / `ScheduledEvent` / `EventScheduler` | A scheduled occurrence in the exercise timeline. Code uses "event" throughout. |
| **Defect** | `Issue` / `TrackedIssue` / `IssueManager` | A problem surfaced during the exercise. Code uses "issue" throughout. |
| **Exercise** | `Exercise` / `ExerciseEngine` | A running instance of a scenario. |
| **Scenario** | `Scenario` / `ScenarioContent` | A reusable exercise template. |
| **Decision** | `DecisionPoint` / `DecisionManager` | A question posed to players. |
| **Game Master (GM)** | GM | The facilitator running the exercise. |
| **Player** | Participant | Someone responding to injects and defects. |

## Glossary

<!-- Domain-specific terms the LLM should use consistently in naming. -->

| Term | Definition |
|------|-----------|
