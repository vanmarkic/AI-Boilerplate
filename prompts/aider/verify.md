# Verification Before Completion

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

If you haven't run the verification command, you cannot claim it passes.

**Core principle:** Evidence before claims, always.

## The Gate Function

```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

## Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check, extrapolation |
| Build succeeds | Build command: exit 0 | Linter passing, "looks good" |
| Bug fixed | Reproduce test: passes | Code changed, assumed fixed |

## Red Flags — STOP

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification ("Great!", "Done!")
- About to commit without running tests
- Relying on partial verification
- Thinking "just this once"
- ANY wording implying success without having run verification

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "Should work now" | RUN the verification |
| "I'm confident" | Confidence != evidence |
| "Just this once" | No exceptions |
| "Linter passed" | Linter != compiler |
| "Partial check is enough" | Partial proves nothing |

## Key Patterns

**Tests:**
- CORRECT: Run test command -> See: 34/34 pass -> "All tests pass"
- WRONG: "Should pass now" / "Looks correct"

**Build:**
- CORRECT: Run build -> See: exit 0 -> "Build passes"
- WRONG: "Linter passed" (linter doesn't check compilation)

**Requirements:**
- CORRECT: Re-read plan -> Checklist -> Verify each -> Report
- WRONG: "Tests pass, phase complete"

## The Bottom Line

**No shortcuts for verification.**

Run the command. Read the output. THEN claim the result.

This is non-negotiable.
