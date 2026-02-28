# Systematic Debugging

## The Iron Law

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

If you haven't completed Phase 1, you cannot propose fixes.

Random fixes waste time and create new bugs. Quick patches mask underlying issues.

## The Four Phases

### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Don't skip past errors or warnings
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - If not reproducible, gather more data — don't guess

3. **Check Recent Changes**
   - What changed? Git diff, recent commits
   - New dependencies, config changes
   - Environmental differences

4. **Gather Evidence in Multi-Component Systems**
   - Log what data enters/exits each component
   - Verify environment/config propagation
   - Run once to gather evidence showing WHERE it breaks
   - THEN investigate the failing component

5. **Trace Data Flow**
   - Where does the bad value originate?
   - What called this with the bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

### Phase 2: Pattern Analysis

1. **Find Working Examples** — similar working code in same codebase
2. **Compare Against References** — read reference implementations COMPLETELY
3. **Identify Differences** — list every difference, however small
4. **Understand Dependencies** — what settings, config, environment?

### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis** — "I think X is the root cause because Y"
2. **Test Minimally** — smallest possible change, one variable at a time
3. **Verify** — did it work? If not, form NEW hypothesis. Don't pile fixes.
4. **When You Don't Know** — say so. Don't pretend.

### Phase 4: Implementation

1. **Create Failing Test Case** — simplest reproduction, automated if possible
2. **Implement Single Fix** — address root cause, ONE change, no "while I'm here"
3. **Verify Fix** — test passes? No regressions?
4. **If 3+ Fixes Failed** — STOP. Question the architecture. Discuss before attempting more.

## Red Flags — STOP and Follow Process

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "I'm confident it's X" (without evidence)
- "One more fix attempt" (when already tried 2+)
- Proposing solutions before tracing data flow
- Each fix reveals new problem in different place

**ALL of these mean: STOP. Return to Phase 1.**

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "Issue is simple" | Simple issues have root causes too. |
| "Emergency, no time" | Systematic is FASTER than thrashing. |
| "Just try this first" | First fix sets the pattern. Do it right. |
| "Multiple fixes saves time" | Can't isolate what worked. Causes new bugs. |
| "I see the problem" | Seeing symptoms != understanding root cause. |

## Quick Reference

| Phase | Key Activities | Done When |
|-------|---------------|-----------|
| 1. Root Cause | Read errors, reproduce, check changes, trace flow | Understand WHAT and WHY |
| 2. Pattern | Find working examples, compare differences | Differences identified |
| 3. Hypothesis | Form theory, test minimally | Confirmed or new hypothesis |
| 4. Implementation | Create test, fix, verify | Bug resolved, tests pass |
