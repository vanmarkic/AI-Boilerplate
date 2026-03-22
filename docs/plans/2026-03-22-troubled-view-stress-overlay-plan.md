# Troubled View — Stress Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a progressive "wounded FPS" visual overlay to the player view that activates at stress 7 and escalates through stress 10, with scenario-configurable intensity presets.

**Architecture:** Pure CSS overlay driven by Angular signals. A standalone `StressOverlayComponent` reads stress from the exercise store and a preset from scenario context. CSS custom properties drive vignette, pulse, and shake effects. Backend passes the preset through the existing `/engine/context` endpoint.

**Tech Stack:** Angular 21 (signals, standalone components), CSS (@layer, @keyframes, custom properties), ngrx signalStore, FastAPI (Python dataclass)

**Design doc:** `docs/plans/2026-03-22-troubled-view-stress-overlay-design.md`

---

## Task 1: Add `stress_effect_preset` to backend scenario model

**Files:**
- Modify: `apps/tfc/backend/features/scenario/scenario_content.py:182-205` (ScenarioContent)
- Modify: `apps/tfc/backend/engine/engine_config.py:46-53` (ScenarioContext)
- Modify: `apps/tfc/backend/features/scenario/scenario_loader.py:358-366` (build_engine_config)

**Step 1: Add field to ScenarioContent (Pydantic model)**

In `scenario_content.py`, add to `ScenarioContent` class after `score_tier_thresholds`:

```python
stress_effect_preset: str = "standard"  # "off" | "mild" | "standard" | "intense"
```

**Step 2: Add field to ScenarioContext (engine dataclass)**

In `engine_config.py`, add to `ScenarioContext` after `score_tier_thresholds`:

```python
stress_effect_preset: str = "standard"
```

**Step 3: Wire in scenario_loader.py**

In `scenario_loader.py`, add to the `ScenarioContext(...)` constructor call at line ~358, after `score_tier_thresholds`:

```python
stress_effect_preset=content.stress_effect_preset,
```

**Step 4: Commit**

```bash
git add apps/tfc/backend/features/scenario/scenario_content.py apps/tfc/backend/engine/engine_config.py apps/tfc/backend/features/scenario/scenario_loader.py
git commit -m "feat(tfc): add stress_effect_preset to scenario model and engine context"
```

---

## Task 2: Expose preset via `/engine/context` endpoint

**Files:**
- Modify: `apps/tfc/backend/features/exercise/engine_router.py:280-294`
- Modify: `apps/tfc/backend/features/exercise/engine_context_prop_test.py`

**Step 1: Add to context response**

In `engine_router.py`, `get_engine_context()`, add to the return dict after `"score_tier_thresholds"`:

```python
"stress_effect_preset": ctx.stress_effect_preset,
```

**Step 2: Update the prop test helper**

In `engine_context_prop_test.py`, update `REQUIRED_CONTEXT_KEYS` to include `"stress_effect_preset"`:

```python
REQUIRED_CONTEXT_KEYS = {"title", "description", "briefing", "objectives", "rules", "roles", "stress_effect_preset"}
```

Update `build_context_response()` to include:

```python
"stress_effect_preset": ctx.stress_effect_preset,
```

Update `scenario_contexts()` strategy to include:

```python
stress_effect_preset=draw(st.sampled_from(["off", "mild", "standard", "intense"])),
```

**Step 3: Run backend tests**

Run: `make test-tfc-backend`
Expected: All tests pass, including the updated property tests.

**Step 4: Commit**

```bash
git add apps/tfc/backend/features/exercise/engine_router.py apps/tfc/backend/features/exercise/engine_context_prop_test.py
git commit -m "feat(tfc): expose stress_effect_preset in engine context endpoint"
```

---

## Task 3: Add preset to frontend types and store

**Files:**
- Modify: `apps/tfc/frontend/src/app/core/scenario-api.service.ts:120-144` (ScenarioContent interface)
- Modify: `apps/tfc/frontend/src/app/core/decision-api.service.ts:67-75` (ScenarioContext interface)
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts` (store method + emptyContent)

**Step 1: Add to frontend ScenarioContent**

In `scenario-api.service.ts`, add to `ScenarioContent` interface after `score_tier_thresholds`:

```typescript
stress_effect_preset?: 'off' | 'mild' | 'standard' | 'intense';
```

**Step 2: Add to frontend ScenarioContext**

In `decision-api.service.ts`, add to `ScenarioContext` interface after `score_tier_thresholds`:

```typescript
stress_effect_preset?: 'off' | 'mild' | 'standard' | 'intense';
```

**Step 3: Add store method**

In `scenario-builder.store.ts`, add a `setStressEffectPreset` method following the same pattern as `setGameMode`:

```typescript
setStressEffectPreset(stress_effect_preset: 'off' | 'mild' | 'standard' | 'intense'): void {
  patchState(store, {
    content: { ...store.content(), stress_effect_preset },
  });
},
```

**Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/core/scenario-api.service.ts apps/tfc/frontend/src/app/core/decision-api.service.ts apps/tfc/frontend/src/app/features/scenario-builder/scenario-builder.store.ts
git commit -m "feat(tfc): add stress_effect_preset to frontend types and builder store"
```

---

## Task 4: Create StressOverlayComponent

**Files:**
- Create: `apps/tfc/frontend/src/app/shared/stress-overlay.component.ts`

**Step 1: Create the component**

Create a standalone Angular component with:
- Inputs: `stress` (number, 0-10), `preset` (string literal union, default `'standard'`)
- Computed `severity` signal: 0 when stress < 7, linear 0→1 from 7→10
- Host binds CSS custom properties via `[style]`: `--stress-severity`, `--stress-pulse-duration`, `--stress-shake`
- Template: single `<div class="stress-overlay">` with `pointer-events: none`
- When preset is `'off'` or severity is 0, the div is hidden via `@if`

```typescript
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from "@angular/core";

type StressPreset = 'off' | 'mild' | 'standard' | 'intense';

interface PresetConfig {
  vignetteMax: number;
  bpmLow: number;
  bpmHigh: number;
  shakeOnset: number;
  shakeMag: number;
}

const PRESETS: Record<Exclude<StressPreset, 'off'>, PresetConfig> = {
  mild:     { vignetteMax: 0.25, bpmLow: 50,  bpmHigh: 80,  shakeOnset: 10, shakeMag: 1   },
  standard: { vignetteMax: 0.40, bpmLow: 60,  bpmHigh: 120, shakeOnset: 9,  shakeMag: 1.5 },
  intense:  { vignetteMax: 0.55, bpmLow: 70,  bpmHigh: 160, shakeOnset: 8,  shakeMag: 2.5 },
};

@Component({
  selector: "tfc-stress-overlay",
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: "stress-overlay-host",
  },
  template: `
    @if (severity() > 0) {
      <div
        class="stress-overlay"
        [style.--stress-severity]="severity()"
        [style.--stress-vignette-max]="vignetteMax()"
        [style.--stress-pulse-duration]="pulseDuration()"
        [style.--stress-shake]="shakeMag()"
      ></div>
    }
  `,
})
export class StressOverlayComponent {
  readonly stress = input(0);
  readonly preset = input<StressPreset>("standard");

  protected readonly severity = computed(() => {
    if (this.preset() === "off") return 0;
    const s = this.stress();
    if (s < 7) return 0;
    return Math.min((s - 7) / 3, 1);
  });

  private readonly config = computed(() => {
    const p = this.preset();
    if (p === "off") return null;
    return PRESETS[p];
  });

  protected readonly vignetteMax = computed(() => this.config()?.vignetteMax ?? 0);

  protected readonly pulseDuration = computed(() => {
    const c = this.config();
    if (!c) return "0s";
    const sev = this.severity();
    const bpm = c.bpmLow + (c.bpmHigh - c.bpmLow) * sev;
    return `${(60 / bpm).toFixed(2)}s`;
  });

  protected readonly shakeMag = computed(() => {
    const c = this.config();
    if (!c) return "0px";
    const s = this.stress();
    if (s < c.shakeOnset) return "0px";
    const shakeProgress = Math.min((s - c.shakeOnset) / (10 - c.shakeOnset), 1);
    return `${(c.shakeMag * shakeProgress).toFixed(1)}px`;
  });
}
```

**Step 2: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/stress-overlay.component.ts
git commit -m "feat(tfc): create StressOverlayComponent with preset-driven severity"
```

---

## Task 5: Add CSS for vignette, pulse, and shake

**Files:**
- Modify: `apps/tfc/frontend/src/app/shared/components-player-view.css`

**Step 1: Add styles at the end of the `@layer components` block**

Add before the closing `}` of `@layer components`:

```css
/* ── Stress Overlay ──────────────────────────────────── */

.stress-overlay-host {
  display: contents;
}
.stress-overlay {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 50;
  background: radial-gradient(
    ellipse at center,
    transparent calc(100% - 100% * var(--stress-vignette-max) * var(--stress-severity)),
    oklch(0% 0 0 / calc(0.7 * var(--stress-severity))) 100%
  );
  animation:
    stress-pulse var(--stress-pulse-duration) ease-in-out infinite,
    stress-shake 0.08s linear infinite;
  animation-play-state: running;
}

@keyframes stress-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: calc(0.5 + 0.5 * (1 - var(--stress-severity))); }
}

@keyframes stress-shake {
  0%  { translate: 0 0; }
  25% { translate: var(--stress-shake) calc(-1 * var(--stress-shake)); }
  50% { translate: calc(-1 * var(--stress-shake)) var(--stress-shake); }
  75% { translate: var(--stress-shake) var(--stress-shake); }
  100% { translate: calc(-0.5 * var(--stress-shake)) calc(-0.5 * var(--stress-shake)); }
}

@media (prefers-reduced-motion: reduce) {
  .stress-overlay {
    animation: none;
  }
}
```

**Step 2: Commit**

```bash
git add apps/tfc/frontend/src/app/shared/components-player-view.css
git commit -m "feat(tfc): add stress overlay CSS — vignette, pulse, shake keyframes"
```

---

## Task 6: Wire overlay into player view

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.ts:39-57` (imports array + class)
- Modify: `apps/tfc/frontend/src/app/features/player/player-view.html:1-3`

**Step 1: Import component in player-view.ts**

Add `StressOverlayComponent` to the imports array in `player-view.ts`:

```typescript
import { StressOverlayComponent } from "../../shared/stress-overlay.component";
```

Add to the `imports` array in the `@Component` decorator:

```typescript
StressOverlayComponent,
```

Add a computed signal for the preset:

```typescript
protected readonly stressEffectPreset = computed(
  () => this.store.context()?.stress_effect_preset ?? 'standard',
);
```

**Step 2: Add to template**

In `player-view.html`, add after `<tfc-ambient-background />` (line 1):

```html
<tfc-stress-overlay
  [stress]="store.score()?.stress ?? 0"
  [preset]="stressEffectPreset()"
/>
```

**Step 3: Commit**

```bash
git add apps/tfc/frontend/src/app/features/player/player-view.ts apps/tfc/frontend/src/app/features/player/player-view.html
git commit -m "feat(tfc): wire stress overlay into player view"
```

---

## Task 7: Add preset picker to scenario builder Setup tab

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts`

**Step 1: Add computed signal for current preset**

In `ScenarioSetupTabComponent` class, add:

```typescript
protected readonly stressEffectPreset = computed(
  () => this.store.content().stress_effect_preset ?? 'standard',
);
```

**Step 2: Add template section**

After the "Default Time Factor" section (before the closing `</ui-card>` of Section 2: Scenario Metadata), add:

```html
<!-- Stress Effect Preset -->
<div class="flex flex-col gap-xs">
  <span class="text-sm font-medium">Stress Effect</span>
  <p class="text-xs text-muted-foreground">
    Visual overlay intensity when stress approaches 10
  </p>
  <div class="flex gap-sm">
    @for (opt of stressPresetOptions; track opt.value) {
      <button uiButton size="sm"
        [variant]="stressEffectPreset() === opt.value ? 'default' : 'outline'"
        (click)="store.setStressEffectPreset(opt.value)">
        {{ opt.label }}
      </button>
    }
  </div>
</div>
```

**Step 3: Add preset options constant**

In the component class, add:

```typescript
protected readonly stressPresetOptions = [
  { value: 'off' as const, label: 'Off' },
  { value: 'mild' as const, label: 'Mild' },
  { value: 'standard' as const, label: 'Standard' },
  { value: 'intense' as const, label: 'Intense' },
];
```

**Step 4: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts
git commit -m "feat(tfc): add stress effect preset picker to scenario builder setup tab"
```

---

## Task 8: Add inline preview to Setup tab

**Files:**
- Modify: `apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts`

**Step 1: Import StressOverlayComponent and add to imports array**

```typescript
import { StressOverlayComponent } from "../../shared/stress-overlay.component";
```

Add to `@Component` imports array.

**Step 2: Add preview state signals**

In the component class:

```typescript
protected readonly previewStress = signal(0);
protected readonly previewing = signal(false);
private previewTimer: ReturnType<typeof setInterval> | null = null;
```

**Step 3: Add preview method**

```typescript
protected startPreview(): void {
  if (this.previewing()) return;
  this.previewing.set(true);
  this.previewStress.set(0);
  const steps = 50; // 5 seconds / 100ms per step
  let step = 0;
  this.previewTimer = setInterval(() => {
    step++;
    this.previewStress.set((step / steps) * 10);
    if (step >= steps) {
      this.stopPreview();
    }
  }, 100);
}

private stopPreview(): void {
  if (this.previewTimer) {
    clearInterval(this.previewTimer);
    this.previewTimer = null;
  }
  this.previewing.set(false);
  this.previewStress.set(0);
}
```

**Step 4: Add preview button and overlay to template**

After the preset button group `</div>`, add:

```html
<button uiButton variant="outline" size="sm"
  [disabled]="stressEffectPreset() === 'off' || previewing()"
  (click)="startPreview()">
  {{ previewing() ? 'Previewing...' : 'Preview' }}
</button>
@if (previewing()) {
  <tfc-stress-overlay
    [stress]="previewStress()"
    [preset]="stressEffectPreset()"
  />
}
```

**Step 5: Clean up timer on destroy**

Add `OnDestroy` to the implements list. Add:

```typescript
ngOnDestroy(): void {
  this.stopPreview();
}
```

**Step 6: Commit**

```bash
git add apps/tfc/frontend/src/app/features/scenario-builder/scenario-setup-tab.ts
git commit -m "feat(tfc): add inline stress overlay preview to scenario builder setup"
```

---

## Task 9: Update seed data

**Files:**
- Modify: `apps/tfc/backend/seeds/silent_wake.json`

**Step 1: Add field to seed**

Add `"stress_effect_preset": "standard"` to the top-level content object in the seed JSON, alongside other top-level fields like `game_mode`.

**Step 2: Run seed validation**

Run: `cd apps/tfc/backend && python -m pytest seed_validation_test.py -v` (or the equivalent validation command)
Expected: PASS

**Step 3: Commit**

```bash
git add apps/tfc/backend/seeds/silent_wake.json
git commit -m "feat(tfc): add stress_effect_preset to silent wake seed"
```

---

## Task 10: Run full validation

**Step 1: Run backend tests**

Run: `make test-tfc-backend`
Expected: All tests pass.

**Step 2: Run frontend tests**

Run: `make test-tfc-frontend`
Expected: All tests pass.

**Step 3: Run linters**

Run: `make validate`
Expected: All checks pass.
