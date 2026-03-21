import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { StressBarComponent } from "./stress-bar.component";

@Component({
  selector: "test-host",
  imports: [StressBarComponent],
  template: `<tfc-stress-bar [stress]="stress()" />`,
})
class TestHost {
  stress = signal(0);
}

describe("StressBarComponent", () => {
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

  function severity(): string | null {
    return el.querySelector("[data-severity]")?.getAttribute("data-severity") ?? null;
  }

  function fillWidth(): string {
    return (el.querySelector(".stress-bar__fill") as HTMLElement).style.width;
  }

  // ── Display ──

  it("should display stress value as text", () => {
    host.stress.set(7);
    fixture.detectChanges();
    expect(el.textContent).toContain("7");
  });

  it("should display 0 when stress is 0", () => {
    host.stress.set(0);
    fixture.detectChanges();
    expect(el.textContent).toContain("0");
  });

  // ── Severity boundaries ──

  it("should classify stress=0 as low", () => {
    host.stress.set(0);
    fixture.detectChanges();
    expect(severity()).toBe("low");
  });

  it("should classify stress=3 as low (upper boundary)", () => {
    host.stress.set(3);
    fixture.detectChanges();
    expect(severity()).toBe("low");
  });

  it("should classify stress=4 as medium (lower boundary)", () => {
    host.stress.set(4);
    fixture.detectChanges();
    expect(severity()).toBe("medium");
  });

  it("should classify stress=6 as medium (upper boundary)", () => {
    host.stress.set(6);
    fixture.detectChanges();
    expect(severity()).toBe("medium");
  });

  it("should classify stress=7 as high (lower boundary)", () => {
    host.stress.set(7);
    fixture.detectChanges();
    expect(severity()).toBe("high");
  });

  it("should classify stress=10 as high (max)", () => {
    host.stress.set(10);
    fixture.detectChanges();
    expect(severity()).toBe("high");
  });

  // ── Fill width ──

  it("should set fill width to 0% for stress=0", () => {
    host.stress.set(0);
    fixture.detectChanges();
    expect(fillWidth()).toBe("0%");
  });

  it("should set fill width to 50% for stress=5", () => {
    host.stress.set(5);
    fixture.detectChanges();
    expect(fillWidth()).toBe("50%");
  });

  it("should set fill width to 100% for stress=10", () => {
    host.stress.set(10);
    fixture.detectChanges();
    expect(fillWidth()).toBe("100%");
  });

  it("should clamp fill width at 100% for stress > 10", () => {
    host.stress.set(15);
    fixture.detectChanges();
    expect(fillWidth()).toBe("100%");
  });
});
