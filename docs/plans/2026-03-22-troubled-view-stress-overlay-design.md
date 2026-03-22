# Troubled View — Progressive Stress Overlay

**Date**: 2026-03-22
**Status**: Approved

## Summary

A CSS-only overlay on the player view that activates at stress 7 and escalates through stress 10, layering three progressive effects — vignette, heartbeat pulse, and screen shake — inspired by FPS "wounded" screen overlays. Scenario authors can configure intensity via presets in the Setup tab, with inline preview.

## Effects

### 1. Vignette (stress 7–10)

Dark radial shadow creeping inward from screen edges. At stress 7 barely noticeable; at 10 covers up to the preset's max edge coverage.

Implementation: `radial-gradient(ellipse at center, transparent <inner-stop>, oklch(0% 0 0 / <opacity>) 100%)` where inner-stop and opacity are driven by a `--stress-severity` custom property (0–1).

### 2. Pulse (stress 7–10)

The vignette throbs like a heartbeat. Slow at stress 7, accelerating toward stress 10. Implemented via CSS animation oscillating vignette opacity between a base and peak value.

### 3. Screen shake (preset-dependent onset, stress 9–10 for Standard)

Subtle CSS `translate` jitter. Small magnitude (1–2.5px depending on preset) to remain readable but feel unsettling. Uses a multi-step keyframe animation with pseudo-random offsets.

## Intensity Presets

Configurable per scenario. Default: `standard`.

| Preset       | Vignette max | Pulse BPM range | Shake onset    | Shake magnitude |
|--------------|-------------|-----------------|----------------|-----------------|
| **off**      | —           | —               | —              | —               |
| **mild**     | 25% edge    | 50–80 BPM       | stress 10 only | 1px             |
| **standard** | 40% edge    | 60–120 BPM      | stress 9       | 1.5px           |
| **intense**  | 55% edge    | 70–160 BPM      | stress 8       | 2.5px           |

All presets share **stress 7** as onset threshold for vignette/pulse.

## Accessibility

`prefers-reduced-motion: reduce` disables pulse and shake animations, keeping only a static vignette.

## Component: `StressOverlayComponent`

Standalone Angular component. Inputs:

- `stress: number` — 0–10, from the exercise store
- `preset: 'off' | 'mild' | 'standard' | 'intense'` — from scenario config

Computed signals:

- `severity` — 0 when stress < 7, linear 0→1 from stress 7→10
- `--stress-severity` CSS custom property (0–1) — drives vignette spread/opacity
- `--stress-pulse-duration` — interpolated from preset BPM range by severity
- `--stress-shake` — magnitude in px, non-zero only above preset's shake threshold

Rendering: single `<div>` with `position: fixed; inset: 0; pointer-events: none; z-index: 50`.

## Scenario Editor Integration

### Model change

New optional field on scenario: `stress_effect_preset: 'off' | 'mild' | 'standard' | 'intense'` (default `'standard'`).

### Setup tab

A "Stress Effects" section containing:

- Radio group for the four preset options (off / mild / standard / intense)
- "Preview" button that runs a 5-second animation ramping a local stress signal from 0→10, rendering the `StressOverlayComponent` inline over the editor area

## Files

| Action     | File                                          | Description                              |
|------------|-----------------------------------------------|------------------------------------------|
| **Create** | `shared/stress-overlay.component.ts`          | The overlay component                    |
| **Modify** | `shared/components-player-view.css`           | Vignette, pulse, shake keyframes         |
| **Modify** | `player/player-view.html`                     | Add `<tfc-stress-overlay>`               |
| **Modify** | `player/player-view.ts`                       | Import and wire stress + preset          |
| **Modify** | Scenario model + builder store                | Add `stress_effect_preset` field         |
| **Modify** | Builder Setup tab                             | Add preset picker + preview              |
