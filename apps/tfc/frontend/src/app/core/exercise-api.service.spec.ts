import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ExerciseApiService } from './exercise-api.service';
import type { CreateExerciseRequest, ExerciseResponse } from './exercise-api.service';
import { environment } from './environment';

describe('ExerciseApiService', () => {
  let service: ExerciseApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  const stubExercise: ExerciseResponse = {
    id: 1,
    title: 'Test Exercise',
    description: '',
    phase: 'setup',
    scenario_id: 10,
    domain_id: null,
    time_factor: 1.0,
    created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ExerciseApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('create', () => {
    it('sends POST to /api/exercises with the request body', () => {
      const payload: CreateExerciseRequest = {
        title: 'New Exercise',
        scenario_id: 10,
        time_factor: 2.0,
      };

      let result: ExerciseResponse | undefined;
      service.create(payload).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${base}/api/exercises`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush(stubExercise);
      expect(result).toEqual(stubExercise);
    });

    it('sends minimal payload when optional fields are omitted', () => {
      service.create({ title: 'Minimal' }).subscribe();

      const req = httpTesting.expectOne(`${base}/api/exercises`);
      expect(req.request.body).toEqual({ title: 'Minimal' });
      req.flush({ ...stubExercise, title: 'Minimal' });
    });
  });

  describe('list', () => {
    it('sends GET to /api/exercises without params when phase is omitted', () => {
      service.list().subscribe();

      const req = httpTesting.expectOne((r) => r.url === `${base}/api/exercises`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.has('phase')).toBe(false);
      req.flush([stubExercise]);
    });

    it('sends phase query param when provided', () => {
      service.list('setup').subscribe();

      const req = httpTesting.expectOne((r) => r.url === `${base}/api/exercises`);
      expect(req.request.params.get('phase')).toBe('setup');
      req.flush([stubExercise]);
    });

    it('returns empty array when no exercises exist', () => {
      let result: ExerciseResponse[] | undefined;
      service.list().subscribe((r) => (result = r));

      const req = httpTesting.expectOne((r) => r.url === `${base}/api/exercises`);
      req.flush([]);
      expect(result).toEqual([]);
    });
  });

  describe('get', () => {
    it('sends GET to /api/exercises/:id', () => {
      let result: ExerciseResponse | undefined;
      service.get(42).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${base}/api/exercises/42`);
      expect(req.request.method).toBe('GET');
      req.flush(stubExercise);
      expect(result).toEqual(stubExercise);
    });
  });
});
