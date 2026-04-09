import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DecisionApiService } from './decision-api.service';
import { environment } from './environment';

describe('DecisionApiService', () => {
  let service: DecisionApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DecisionApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('listDecisions', () => {
    it('sends exercise_id and status when status is provided', () => {
      service.listDecisions(42, 'closed').subscribe();
      const req = httpTesting.expectOne(
        (r) => r.url === `${base}/api/decisions`,
      );
      expect(req.request.params.get('exercise_id')).toBe('42');
      expect(req.request.params.get('status')).toBe('closed');
      req.flush([]);
    });

    it('sends only exercise_id when status is omitted', () => {
      service.listDecisions(42).subscribe();
      const req = httpTesting.expectOne(
        (r) => r.url === `${base}/api/decisions`,
      );
      expect(req.request.params.get('exercise_id')).toBe('42');
      expect(req.request.params.has('status')).toBe(false);
      req.flush([]);
    });
  });
});
