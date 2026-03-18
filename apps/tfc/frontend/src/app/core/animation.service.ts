/**
 * TFC-only GSAP wrapper service.
 * Respects prefers-reduced-motion and provides helpers
 * for common animation patterns used in the player view.
 */
import { Injectable, signal } from "@angular/core";
import gsap from "gsap";

@Injectable({ providedIn: "root" })
export class AnimationService {
  readonly reducedMotion = signal(false);

  constructor() {
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    this.reducedMotion.set(mq?.matches ?? false);
    mq?.addEventListener("change", (e) => this.reducedMotion.set(e.matches));
  }

  /** Animate one or more targets. Skips if reduced-motion is active. */
  to(targets: gsap.TweenTarget, vars: gsap.TweenVars): gsap.core.Tween | null {
    if (this.reducedMotion()) return null;
    return gsap.to(targets, vars);
  }

  /** Animate from initial state. Skips if reduced-motion is active. */
  from(
    targets: gsap.TweenTarget,
    vars: gsap.TweenVars,
  ): gsap.core.Tween | null {
    if (this.reducedMotion()) return null;
    return gsap.from(targets, vars);
  }

  /** Stagger entrance animation for a list of elements. */
  staggerIn(
    targets: gsap.TweenTarget,
    vars?: gsap.TweenVars,
  ): gsap.core.Tween | null {
    if (this.reducedMotion()) return null;
    return gsap.from(targets, {
      y: 30,
      opacity: 0,
      rotateX: -8,
      duration: 0.45,
      stagger: 0.08,
      ease: "power3.out",
      ...vars,
    });
  }

  /** Create a GSAP timeline. Returns null if reduced-motion. */
  timeline(vars?: gsap.TimelineVars): gsap.core.Timeline | null {
    if (this.reducedMotion()) return null;
    return gsap.timeline(vars);
  }

  /** Number counter tween — animates a proxy object and calls onUpdate. */
  counter(
    from: number,
    to: number,
    onUpdate: (value: number) => void,
    duration = 0.8,
  ): gsap.core.Tween | null {
    if (this.reducedMotion()) {
      onUpdate(to);
      return null;
    }
    const proxy = { val: from };
    return gsap.to(proxy, {
      val: to,
      duration,
      ease: "power2.out",
      onUpdate: () => onUpdate(Math.round(proxy.val)),
    });
  }

  /** Quick screen-shake effect on a container. */
  shake(
    target: gsap.TweenTarget,
    intensity = 2,
    duration = 0.3,
  ): gsap.core.Timeline | null {
    if (this.reducedMotion()) return null;
    const tl = gsap.timeline();
    tl.to(target, {
      x: intensity,
      duration: duration / 6,
      ease: "power2.inOut",
    })
      .to(target, {
        x: -intensity,
        duration: duration / 6,
        ease: "power2.inOut",
      })
      .to(target, {
        x: intensity * 0.6,
        duration: duration / 6,
        ease: "power2.inOut",
      })
      .to(target, {
        x: -intensity * 0.6,
        duration: duration / 6,
        ease: "power2.inOut",
      })
      .to(target, { x: 0, duration: duration / 3, ease: "power2.out" });
    return tl;
  }

  /** Pulse glow on an element (scale bounce + opacity). */
  pulse(target: gsap.TweenTarget, scale = 1.05): gsap.core.Tween | null {
    if (this.reducedMotion()) return null;
    return gsap.fromTo(
      target,
      { scale: 1, opacity: 1 },
      {
        scale,
        opacity: 0.85,
        duration: 0.3,
        yoyo: true,
        repeat: 1,
        ease: "power2.inOut",
      },
    );
  }

  /** Kill all tweens on a target. Safe to call anytime. */
  kill(target: gsap.TweenTarget): void {
    gsap.killTweensOf(target);
  }
}
