# Cost Assessment: Light 3D Visuals for Silent Wake (Simple-Collaborative Mode)

## Context

TFC's player view is currently a functional but visually flat DOM-based interface (cards, badges, lists, modal overlays). The Silent Wake tutorial scenario — a 3-turn naval port approach — would benefit from **visual polish and micro-animations** to increase player engagement during the decision/discussion phases. The goal is **not** a WebGL 3D scene but rather CSS/SVG pseudo-3D effects and GSAP-driven micro-animations embedded in the existing player view.

---

## Scope Definition

**In scope:** Visual candy, micro-animations, CSS 3D transforms, SVG illustrations, GSAP timeline animations — all within the player view (`apps/tfc/frontend/src/app/features/player/player-view.ts`).

**Out of scope:** WebGL/Three.js, tactical map, full 3D ship model, GM view changes, new game mechanics.

---

## Relationship to Shared UI (`packages/ui/`)

Per project rules, `packages/ui/` contains **only generic, reusable building blocks** (card, badge, button, dialog, etc.). All animation work stays **TFC-scoped**:

| Layer | Location | What goes here |
|-------|----------|----------------|
| `packages/design-system/` | `components.css` | Animation **design tokens only** (`--duration-fast: 150ms`, `--duration-slow: 600ms`, `--ease-spring: cubic-bezier(...)`) — these are framework-agnostic CSS custom properties, consistent with the existing token approach |
| `packages/ui/` | **No changes** | No GSAP dependency, no animation logic. Generic components remain animation-free |
| `apps/tfc/frontend/` `src/app/core/` | `animation.service.ts` | TFC-only GSAP wrapper service. Handles `prefers-reduced-motion`, provides `animate()`, `timeline()`, `stagger()` helpers |
| `apps/tfc/frontend/` `src/app/shared/` | `decision-panel.component.ts`, `clock-display.component.ts` | Animations added to existing TFC-specific shared components |
| `apps/tfc/frontend/` `src/app/features/player/` | `player-view.ts` + new animation files | Ambient background, score feedback, turn transitions |
| `apps/tfc/frontend/` `src/assets/svg/` | New SVG illustrations | Ship silhouette, system icons, wave patterns |
| `apps/tfc/frontend/` `package.json` | `gsap` dependency | TFC workspace only — not hoisted to root |

**Key principle:** GSAP is a TFC-only dependency. If other apps later want animations, they can adopt their own approach without being coupled to GSAP. The only shared artifact is CSS custom properties for timing/easing tokens in the design system, which is already the established pattern.

---

## Visual Elements Catalogue

### A. Turn Transition Animation
- Full-width SVG banner/vignette that plays when a new turn begins (inject arrives)
- Parallax layers: sea horizon, ship silhouette, sky — sliding/fading with GSAP timeline
- CSS `perspective` + `transform: rotateX()` on layers for depth
- ~3 SVG layers per turn (recolored/repositioned per turn context)
- **Effort: 3–4 dev-days**

### B. System Status Board with Micro-Animations
- Replace flat badge list with an isometric SVG "ship systems panel"
- Each system (NAV RADAR, COMMS, etc.) as an SVG icon with status glow
- Green → Yellow transition: GSAP color tween + pulse animation
- CSS `transform: rotateY(15deg)` on the panel for pseudo-3D tilt
- Hover: subtle lift + shadow shift
- **Effort: 2–3 dev-days**

### C. Decision Card Entrance & Selection
- Cards (SWB01, SWB02, etc.) animate in with GSAP stagger (`from: { y: 40, opacity: 0, rotateX: -10deg }`)
- Selected card: flip animation (CSS `rotateY(180deg)` with front/back faces)
- Submitted card: slide-out + particle-like CSS confetti or ripple
- Timer bar with GSAP-driven countdown shrink + color shift (green → amber → red)
- **Effort: 2–3 dev-days**

### D. Score/Stress Feedback
- Stress change: screen-edge vignette pulse (CSS radial-gradient animation)
- Score increment: number counter animation (GSAP `TextPlugin` or manual tween)
- Penalty applied: subtle screen shake (GSAP `x: "+=2"` oscillation, 300ms)
- Turn-end summary: score flies to score bar with arc motion path
- **Effort: 1–2 dev-days**

### E. Ambient Background
- Subtle CSS gradient animation on the player view background (slow hue shift simulating time-of-day)
- Optional: SVG wave pattern at bottom with CSS `animation: wave` keyframes
- Fog/overlay opacity tied to COMMS degradation state (Yellow = slight fog)
- **Effort: 1 dev-day**

### F. Advisor Recommendation Indicators
- When advisor submits recommendation: small avatar bubble animates in (GSAP scale + fade)
- Recommendation count as animated badge (bounce on increment)
- Decision-maker sees recommendations appear in real-time with stagger
- **Effort: 1 dev-day**

---

## Technology Stack

| Tool | Purpose | Bundle Cost |
|------|---------|-------------|
| **GSAP 3** (free for non-commercial, or GreenSock Club for commercial) | Timeline animations, staggers, easing, ScrollTrigger-free | ~25 KB gzipped |
| **CSS transforms + transitions** | Pseudo-3D tilts, flips, perspective | 0 KB (native) |
| **SVG (inline)** | Ship silhouette, system icons, wave patterns, horizon layers | ~5–15 KB per illustration |
| **Angular `AnimationBuilder`** (optional) | Route/view transitions if needed | Already in Angular |

**GSAP licensing note:** GSAP's "no charge" license covers most uses. If TFC is sold as a product, a GreenSock Business license is ~$150/year. No per-seat cost.

---

## Cost Summary by Tier

### Tier 1 — Essential Polish (recommended starting point)
| Element | Days | Description |
|---------|------|-------------|
| GSAP integration + Angular wrapper | 1 | Shared animation service, OnPush-safe |
| C. Decision card animations | 2.5 | Entrance stagger, selection flip, timer bar |
| D. Score/stress feedback | 1.5 | Number counter, vignette pulse, shake |
| E. Ambient background | 1 | Gradient shift, wave SVG |
| **Subtotal** | **6 days** | |

### Tier 2 — Full Visual Package
| Element | Days | Description |
|---------|------|-------------|
| Tier 1 (above) | 6 | — |
| A. Turn transition animation | 3.5 | Parallax SVG banner, GSAP timeline |
| B. System status board | 2.5 | Isometric SVG panel, status glow transitions |
| F. Advisor recommendation bubbles | 1 | Avatar animations, badge bounce |
| SVG asset creation (6 icons + 3 scene layers) | 2 | Design/illustration work |
| **Subtotal** | **15 days** | |

### Tier 3 — Premium (Tier 2 + extras)
| Element | Days | Description |
|---------|------|-------------|
| Tier 2 (above) | 15 | — |
| Particle/confetti system (CSS-only) | 1.5 | Decision submit celebration |
| Advanced timer (circular SVG countdown) | 1 | Arc-based timer replacing linear bar |
| Responsive polish + perf testing | 1.5 | Tablet/mobile, `prefers-reduced-motion` |
| Storybook stories for all animated components | 1 | Visual QA and documentation |
| **Subtotal** | **20 days** | |

---

## Rough Cost Estimate (at standard dev rates)

| Tier | Dev-Days | At €500/day | At €700/day |
|------|----------|-------------|-------------|
| Tier 1 — Essential Polish | 6 | €3,000 | €4,200 |
| Tier 2 — Full Visual Package | 15 | €7,500 | €10,500 |
| Tier 3 — Premium | 20 | €10,000 | €14,000 |

*SVG illustration work may be outsourced separately (~€500–€1,500 depending on quality/quantity).*

---

## Risks

| Risk | Mitigation |
|------|------------|
| **GSAP + Angular OnPush** | Wrap GSAP in a service that triggers change detection via signals, not zones (already zoneless) |
| **Performance on low-end devices** | All animations CSS/SVG — no WebGL. Use `will-change` sparingly. Respect `prefers-reduced-motion` media query |
| **Bundle size** | GSAP core is ~25KB gzipped. No plugins needed for this scope |
| **Maintenance burden** | Animations are decorative overlays, not coupled to game logic. Can be disabled via a single CSS class or feature flag |
| **SVG asset consistency** | Use a single illustration style guide. Consider a simple flat/geometric naval style |
| **Accessibility** | `prefers-reduced-motion: reduce` disables all GSAP timelines and CSS animations. Screen readers unaffected (decorative only) |

---

## Recommendation

**Start with Tier 1 (6 days, ~€3–4K).** It delivers the highest-impact animations (decision cards, score feedback, ambient mood) with minimal risk. The GSAP integration scaffold built in Tier 1 makes Tier 2 elements easy to add incrementally later. The turn transition (Element A) and system status board (Element B) are the most visually impressive additions but can wait for a second pass after validating the approach with players.

---

## Implementation Approach (if approved)

### Files to create/modify
- `packages/design-system/components.css` — animation design tokens only (`--duration-fast`, `--duration-slow`, `--ease-spring`)
- `apps/tfc/frontend/package.json` — add `gsap` as TFC-only dependency
- `apps/tfc/frontend/src/app/core/animation.service.ts` — **new** — GSAP wrapper, `prefers-reduced-motion` check
- `apps/tfc/frontend/src/app/shared/decision-panel.component.ts` — card entrance/flip animations
- `apps/tfc/frontend/src/app/shared/clock-display.component.ts` — timer bar animation
- `apps/tfc/frontend/src/app/features/player/player-view.ts` — ambient background, score animations
- `apps/tfc/frontend/src/assets/svg/` — **new** — SVG illustrations (ship, icons, waves)
- **No changes to `packages/ui/`**

### Verification
1. `npm install gsap` — confirm bundle size delta
2. Visual QA in Storybook for decision-panel animations
3. Run Silent Wake tutorial end-to-end, verify animations fire on turn transitions and decision events
4. Test with `prefers-reduced-motion: reduce` in browser devtools — all motion should stop
5. `make validate` passes (lint + tests)
