import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { ScoreBarComponent, type ScoreState } from "./score-bar.component";
import { AnimationService } from "../core/animation.service";
import { vi } from "vitest";

@Component({
  selector: "test-host",
  imports: [ScoreBarComponent],
  template: `<tfc-score-bar [score]="score()" [countdownMs]="countdownMs()" />`,
})
class TestHost {
  score = signal<ScoreState | null>(null);
  countdownMs = signal<number | null>(null);
}

function makeScore(overrides: Partial<ScoreState> = {}): ScoreState {
  return {
    turnNumber: 1,
    nextDecisionTimeMs: 0,
    stress: 0,
    scoreTier: null,
    ...overrides,
  };
}

describe("ScoreBarComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let el: HTMLElement;
  const mockAnim = {
    counter: vi.fn(),
    shake: vi.fn(),
    reducedMotion: signal(true),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [TestHost],
    })
      .overrideProvider(AnimationService, { useValue: mockAnim })
      .compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  // ── Basic rendering ──

  it("should show turn number", () => {
    host.score.set(makeScore({ turnNumber: 5 }));
    fixture.detectChanges();
    expect(el.textContent).toContain("Turn 5");
  });

  it("should render stress bar child component", () => {
    host.score.set(makeScore({ stress: 3 }));
    fixture.detectChanges();
    expect(el.querySelector("tfc-stress-bar")).not.toBeNull();
  });

  it("should NOT display numeric score", () => {
    host.score.set(makeScore());
    fixture.detectChanges();
    expect(el.textContent).not.toContain("Score");
    expect(el.querySelector(".score-bar__value")).toBeNull();
  });

  // ── Stress increase triggers shake ──

  it("should trigger shake animation when stress increases", () => {
    host.score.set(makeScore({ stress: 2 }));
    fixture.detectChanges();

    host.score.set(makeScore({ stress: 5 }));
    fixture.detectChanges();

    expect(mockAnim.shake).toHaveBeenCalled();
  });

  it("should not trigger shake when stress stays the same", () => {
    host.score.set(makeScore({ stress: 3 }));
    fixture.detectChanges();
    mockAnim.shake.mockClear();

    host.score.set(makeScore({ stress: 3 }));
    fixture.detectChanges();

    expect(mockAnim.shake).not.toHaveBeenCalled();
  });

  it("should not trigger shake when stress decreases", () => {
    host.score.set(makeScore({ stress: 5 }));
    fixture.detectChanges();
    mockAnim.shake.mockClear();

    host.score.set(makeScore({ stress: 2 }));
    fixture.detectChanges();

    expect(mockAnim.shake).not.toHaveBeenCalled();
  });

  // ── Countdown ──

  it("should show formatted countdown when countdownMs is positive", () => {
    host.score.set(makeScore());
    host.countdownMs.set(95_000);
    fixture.detectChanges();
    expect(el.textContent).toContain("1:35");
  });

  it("should add urgent class when countdown < 30s", () => {
    host.score.set(makeScore());
    host.countdownMs.set(15_000);
    fixture.detectChanges();
    expect(el.querySelector(".score-bar__countdown--urgent")).not.toBeNull();
  });

  it("should not show countdown when countdownMs is null", () => {
    host.score.set(makeScore());
    host.countdownMs.set(null);
    fixture.detectChanges();
    expect(el.querySelector(".score-bar__countdown")).toBeNull();
  });

  // ── Null score ──

  it("should render nothing meaningful when score is null", () => {
    host.score.set(null);
    fixture.detectChanges();
    expect(el.querySelector("tfc-stress-bar")).not.toBeNull();
  });
});
