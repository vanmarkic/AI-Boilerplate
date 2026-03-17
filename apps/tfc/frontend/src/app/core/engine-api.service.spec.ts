import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { EngineApiService } from './engine-api.service';
import { environment } from './environment';

describe('EngineApiService', () => {
  let service: EngineApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EngineApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  describe('pauseEvent', () => {
    it('sends POST to correct URL', () => {
      service.pauseEvent(1, 'e1').subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/events/e1/pause`,
      );
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('resumeEvent', () => {
    it('sends POST to correct URL', () => {
      service.resumeEvent(1, 'e1').subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/events/e1/resume`,
      );
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('delayEvent', () => {
    it('sends POST with delay_ms in body', () => {
      service.delayEvent(1, 'e1', 5000).subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/events/e1/delay`,
      );
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ delay_ms: 5000 });
      req.flush({});
    });
  });

  describe('skipEvent', () => {
    it('sends POST to correct URL', () => {
      service.skipEvent(1, 'e1').subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/events/e1/skip`,
      );
      expect(req.request.method).toBe('POST');
      req.flush({});
    });
  });

  describe('snapshot', () => {
    it('sends GET to correct URL', () => {
      service.snapshot(1).subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/snapshot`,
      );
      expect(req.request.method).toBe('GET');
      req.flush({});
    });
  });

  describe('setSpeed', () => {
    it('sends PUT with factor in body', () => {
      service.setSpeed(1, 3.0).subscribe();
      const req = httpTesting.expectOne(
        `${base}/api/exercises/1/engine/speed`,
      );
      expect(req.request.method).toBe('PUT');
      expect(req.request.body).toEqual({ factor: 3.0 });
      req.flush({});
    });
  });
});
