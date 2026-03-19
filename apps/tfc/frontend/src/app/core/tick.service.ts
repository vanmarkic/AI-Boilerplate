import { Injectable, OnDestroy } from "@angular/core";
import { ExerciseStore } from "./exercise.store";

/**
 * Drives client-side clock interpolation between server updates.
 * Call `start(store)` once the store is available; the service
 * advances realTimeMs / playTimeMs every second via `store.tick()`.
 */
@Injectable()
export class TickService implements OnDestroy {
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastTime = 0;

  start(store: InstanceType<typeof ExerciseStore>): void {
    this.stop();
    this.lastTime = performance.now();
    this.timer = setInterval(() => {
      const now = performance.now();
      const delta = now - this.lastTime;
      this.lastTime = now;
      store.tick(delta);
    }, 1000);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
