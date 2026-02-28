# Executing Implementation Plans

## Overview

Load plan, review critically, execute tasks in batches, report for review between batches.

**Core principle:** Batch execution with checkpoints for review.

## The Process

### Step 1: Load and Review Plan

1. Read the plan file
2. Review critically — identify any questions or concerns
3. If concerns: Raise them before starting
4. If no concerns: Begin execution

### Step 2: Execute Batch (3 tasks at a time)

For each task:
1. Announce which task you're starting
2. Follow each step exactly (plan has bite-sized steps)
3. Run verifications as specified in the plan
4. Announce task completion with results

### Step 3: Report

When batch complete:
- Show what was implemented
- Show verification output (test results, linter output)
- Say: "Batch complete. Ready for feedback before continuing."

### Step 4: Continue

Based on feedback:
- Apply changes if needed
- Execute next batch of 3 tasks
- Repeat until complete

### Step 5: Finish

After all tasks complete and verified:
- Run full test suite
- Run linters
- Present integration options (merge, PR, keep branch)

## When to Stop and Ask

**STOP executing immediately when:**
- Hit a blocker (missing dependency, test fails unexpectedly, instruction unclear)
- Plan has critical gaps
- You don't understand an instruction
- Verification fails repeatedly (3+ times)

**Ask for clarification rather than guessing.**

## Rules

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Between batches: report and wait for feedback
- Stop when blocked, don't guess
- One task at a time within each batch
