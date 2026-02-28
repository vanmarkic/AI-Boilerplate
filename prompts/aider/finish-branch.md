# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling the chosen workflow.

**Core principle:** Verify tests -> Present options -> Execute choice -> Clean up.

## The Process

### Step 1: Verify Tests

Before presenting options, verify tests pass:

```bash
# Run project's test suite
make test
```

If tests fail: STOP. Fix before proceeding.

### Step 2: Determine Base Branch

```bash
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

### Step 3: Present Options

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

### Step 4: Execute Choice

**Option 1: Merge Locally**
```bash
git checkout <base-branch>
git pull
git merge <feature-branch>
make test                    # verify on merged result
git branch -d <feature-branch>
```

**Option 2: Push and Create PR**
```bash
git push -u origin <feature-branch>
gh pr create --title "<title>" --body "<summary>"
```

**Option 3: Keep As-Is**
Report: "Keeping branch <name>."

**Option 4: Discard**
Confirm first — list branch name and commits to be deleted.
Wait for explicit confirmation before deleting.

```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

## Rules

- NEVER proceed with failing tests
- NEVER merge without verifying tests on result
- NEVER delete work without confirmation
- NEVER force-push without explicit request
- ALWAYS present exactly 4 options
- ALWAYS verify tests before offering options
