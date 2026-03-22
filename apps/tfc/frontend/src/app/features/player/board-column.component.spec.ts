import { ComponentFixture, TestBed } from "@angular/core/testing";
import { Component, signal } from "@angular/core";
import { BoardColumnComponent } from "./board-column.component";

@Component({
  imports: [BoardColumnComponent],
  template: `
    <tfc-board-column
      [roleId]="roleId()"
      [roleLabel]="roleLabel()"
      [intel]="intel()"
      [status]="status()"
      [expanded]="expanded()"
      (headerClicked)="onHeaderClick()"
    >
      <ng-template #decisionZone>
        <div data-testid="decision-content">Decision here</div>
      </ng-template>
    </tfc-board-column>
  `,
})
class TestHost {
  readonly roleId = signal("ops");
  readonly roleLabel = signal("Operations Officer");
  readonly intel = signal<string | null>("Phishing detected on port 443");
  readonly status = signal<"intel" | "active" | "done">("active");
  readonly expanded = signal(false);
  headerClickCount = 0;
  onHeaderClick(): void {
    this.headerClickCount++;
  }
}

describe("BoardColumnComponent", () => {
  let fixture: ComponentFixture<TestHost>;
  let host: TestHost;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TestHost],
    }).compileComponents();
    fixture = TestBed.createComponent(TestHost);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it("renders the column with role header", () => {
    expect(
      fixture.nativeElement.querySelector(".board-column"),
    ).toBeTruthy();
    expect(
      fixture.nativeElement
        .querySelector(".board-column__role-id")
        ?.textContent.trim(),
    ).toBe("OPS");
  });

  it("renders role label", () => {
    expect(
      fixture.nativeElement
        .querySelector(".board-column__role-label")
        ?.textContent.trim(),
    ).toBe("Operations Officer");
  });

  it("renders intel text in the intel zone", () => {
    expect(
      fixture.nativeElement
        .querySelector(".board-column__intel")
        ?.textContent.trim(),
    ).toContain("Phishing detected on port 443");
  });

  it("shows empty state when intel is null", () => {
    host.intel.set(null);
    fixture.detectChanges();

    const empty = fixture.nativeElement.querySelector(
      ".board-column__intel .board-column__empty",
    );
    expect(empty).toBeTruthy();
    expect(empty?.textContent.trim()).toContain("Waiting for next turn...");
  });

  it("projects decision zone content", () => {
    expect(
      fixture.nativeElement.querySelector("[data-testid='decision-content']"),
    ).toBeTruthy();
  });

  it("emits headerClicked on header click", () => {
    const header = fixture.nativeElement.querySelector(
      ".board-column__header",
    ) as HTMLElement;
    header.click();
    expect(host.headerClickCount).toBe(1);
  });
});
