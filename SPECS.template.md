# Product Specification

<!--
  This file tells LLM agents WHAT the software does.
  AGENTS.md tells them HOW to write code — this tells them WHY and WHAT.

  Fill every section before starting implementation.
  Update whenever you add a feature or change business rules.
  Stale specs are worse than no specs.

  Tips:
  - Be specific. "Users can search" is vague. "Users search products by name,
    category, or price range; results paginated at 20/page" is actionable.
  - Include validation rules and constraints — these are the #1 thing LLMs
    miss without product context.
  - State edge cases: what happens on conflict, not-found, invalid input.
-->

## What This Is

<!-- 1-2 paragraphs answering: What domain? Who are the users? What problem does it solve? -->

## Domain Model

<!--
  Entity-relationship overview. Use ASCII diagrams.

  Example:
  ```
  User
  ├── id           (PK)
  ├── email        (unique)
  └── name

  Project
  ├── id           (PK)
  ├── owner_id     (FK → User)
  ├── title
  └── status       (enum: draft, active, archived)

  Relationships:
  - User has many Projects
  - Project belongs to one User
  ```
-->

## Features & Business Rules

<!--
  One subsection per feature:

  ### Feature: orders (tier 2, backend + frontend)
  - **Purpose:** Order placement and tracking.
  - **Rules:**
    - Minimum order value: $5.00
    - Order status transitions: pending → paid → shipped → delivered
    - Refunds allowed within 30 days of delivery
  - **User stories:**
    - As a buyer, I want to place an order so that I receive my items.
-->

## API Contract

<!--
  Summary table. Details live in shared/openapi.yaml.

  | Method | Path | Feature | Purpose |
  |--------|------|---------|---------|
  | POST | `/api/orders` | orders | Place a new order |
-->

## Glossary

<!--
  Domain-specific terms the LLM should use consistently in naming.

  | Term | Definition |
  |------|-----------|
  | **SKU** | Stock Keeping Unit — unique product identifier |
-->
