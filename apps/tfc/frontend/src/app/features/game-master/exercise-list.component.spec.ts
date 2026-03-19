import { ComponentFixture, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { ExerciseListComponent } from "./exercise-list.component";
import { environment } from "../../core/environment";
import type { ExerciseResponse } from "../../core/exercise-api.service";

describe("ExerciseListComponent", () => {
  let fixture: ComponentFixture<ExerciseListComponent>;
  let component: ExerciseListComponent;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  const stubExercise: ExerciseResponse = {
    id: 1,
    title: "Test Exercise",
    description: "",
    phase: "setup",
    scenario_id: 10,
    domain_id: null,
    time_factor: 1.0,
    game_mode: "classic",
    practice_mode: false,
    session_code: "ABC123",
    created_at: "2026-03-17T00:00:00Z",
    updated_at: "2026-03-17T00:00:00Z",
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExerciseListComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    httpTesting = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ExerciseListComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
    httpTesting.verify();
  });

  it("loads exercises on init", () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/exercises`);
    expect(req.request.method).toBe("GET");
    req.flush([stubExercise]);
    fixture.detectChanges();

    expect(component["exercises"]()).toEqual([stubExercise]);
  });

  it("shows empty message when no exercises exist", () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/exercises`);
    req.flush([]);
    fixture.detectChanges();

    const empty = fixture.nativeElement.textContent;
    expect(empty).toContain("No existing");
  });

  it("emits exerciseSelected when resume is clicked", () => {
    const spy = vi.fn();
    component.exerciseSelected.subscribe(spy);

    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/exercises`);
    req.flush([stubExercise]);
    fixture.detectChanges();

    const resumeBtn: HTMLButtonElement =
      fixture.nativeElement.querySelector("button[uibutton]");
    resumeBtn.click();

    expect(spy).toHaveBeenCalledWith(stubExercise);
  });

  it("removes exercise from list after delete", () => {
    fixture.detectChanges();
    const listReq = httpTesting.expectOne(`${base}/api/exercises`);
    listReq.flush([stubExercise]);
    fixture.detectChanges();

    const buttons: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll("button[uibutton]"),
    );
    const deleteBtn = buttons.find(
      (b) => b.textContent?.trim() === "Delete",
    );
    deleteBtn!.click();

    const deleteReq = httpTesting.expectOne(`${base}/api/exercises/1`);
    expect(deleteReq.request.method).toBe("DELETE");
    deleteReq.flush(null);

    expect(component["exercises"]()).toEqual([]);
  });

  it("shows error state on load failure", () => {
    fixture.detectChanges();
    const req = httpTesting.expectOne(`${base}/api/exercises`);
    req.error(new ProgressEvent("Network error"));
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain("Failed to load exercises");
  });
});
