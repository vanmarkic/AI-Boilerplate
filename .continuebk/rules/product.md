---
name: Product Context
description: Directs agents to check SPECS.md for product domain knowledge before coding
globs: "**/*"
alwaysApply: true
---

# Product Context

Before writing any code, check if `SPECS.md` exists and is filled in.
If it is empty or missing, ask the user to define the product specification before proceeding.

`SPECS.md` describes WHAT the software does (domain model, business rules, glossary).
`AGENTS.md` describes HOW to write code (conventions, architecture, constraints).
`shared/openapi.yaml` is the API contract — modify the spec first, then implement.
