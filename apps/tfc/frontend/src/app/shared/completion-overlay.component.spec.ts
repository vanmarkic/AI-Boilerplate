import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { CompletionOverlayComponent } from "./completion-overlay.component";
import { vi } from "vitest";

@Component({
  selector: "test-host",
  imports: [CompletionOverlayComponent],
  template: `<tfc-completion-overlay [tier]="tier()" (closed)="onClosed()" />`,
})
class TestHost {
  tier = signal<string | null>(null);
  closedSpy = vi.fn();
  onClosed(): void {
    this.closedSpy();
  }
}

describe("CompletionOverlayComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement;
  });

  it("should show fallback message when tier is null", () => {
    host.tier.set(null);
    fixture.detectChanges();
    expect(el.textContent).toContain("Exercise Complete");
  });

  it("should show 'Solid Effort' for lo tier", () => {
    host.tier.set("lo");
    fixture.detectChanges();
    expect(el.textContent).toContain("Solid Effort");
    expect(el.textContent).toContain("determination");
  });

  it("should show 'Great Performance' for mid tier", () => {
    host.tier.set("mid");
    fixture.detectChanges();
    expect(el.textContent).toContain("Great Performance");
    expect(el.textContent).toContain("decision-making");
  });

  it("should show 'Outstanding' for hi tier", () => {
    host.tier.set("hi");
    fixture.detectChanges();
    expect(el.textContent).toContain("Outstanding");
    expect(el.textContent).toContain("exceptional");
  });

  it("should use positive/encouraging language for all tiers", () => {
    for (const tier of ["lo", "mid", "hi"]) {
      host.tier.set(tier);
      fixture.detectChanges();
      const text = el.textContent ?? "";
      // No negative wording per SPECS
      expect(text.toLowerCase()).not.toContain("fail");
      expect(text.toLowerCase()).not.toContain("poor");
      expect(text.toLowerCase()).not.toContain("bad");
      expect(text.toLowerCase()).not.toContain("wrong");
    }
  });

  it("should never display numeric score", () => {
    for (const tier of [null, "lo", "mid", "hi"]) {
      host.tier.set(tier);
      fixture.detectChanges();
      const text = el.textContent ?? "";
      // Score numbers should never appear
      expect(text).not.toMatch(/\d+\.\d+/);
      expect(text.toLowerCase()).not.toContain("score");
      expect(text.toLowerCase()).not.toContain("points");
    }
  });

  it("should emit closed when button clicked", () => {
    host.tier.set("hi");
    fixture.detectChanges();
    const button = el.querySelector("button");
    expect(button).not.toBeNull();
    button!.click();
    expect(host.closedSpy).toHaveBeenCalled();
  });

  it("should have Return to Home button", () => {
    fixture.detectChanges();
    const button = el.querySelector("button");
    expect(button?.textContent?.trim()).toBe("Return to Home");
  });

  it("should show fallback for unknown tier value", () => {
    host.tier.set("unknown_tier");
    fixture.detectChanges();
    expect(el.textContent).toContain("Exercise Complete");
  });
});
