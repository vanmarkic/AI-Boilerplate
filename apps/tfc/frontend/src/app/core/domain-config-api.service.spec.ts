import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { DomainConfigApiService } from './domain-config-api.service';
import type { DomainConfigResponse } from './domain-config-api.service';
import { environment } from './environment';

describe('DomainConfigApiService', () => {
  let service: DomainConfigApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  const stubConfig: DomainConfigResponse = {
    id: 1,
    slug: 'cybersecurity',
    name: 'Cybersecurity',
    description: 'Cyber domain',
    terminology: {
      event: 'Incident',
      issue: 'Vulnerability',
      player: 'SOC Analyst',
      gameMaster: 'Exercise Director',
      exercise: 'Cyber Exercise',
      scenario: 'Attack Scenario',
      decision: 'Response Action',
    },
    theme: {
      colorPrimary: '#06b6d4',
      colorSecondary: '#8b5cf6',
      colorBackground: '#0f172a',
      colorForeground: '#e2e8f0',
      fontFamily: 'system-ui, sans-serif',
      fontFamilyMono: 'ui-monospace, monospace',
      density: 'compact',
    },
    roles: [
      {
        id: 'soc-analyst',
        label: 'SOC Analyst',
        description: 'Security operations center analyst',
      },
    ],
    severity_levels: [
      { id: 'low', label: 'Low', color: '#22c55e', order: 1 },
    ],
    created_at: '2026-03-17T00:00:00Z',
    updated_at: '2026-03-17T00:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DomainConfigApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
    httpTesting.verify();
  });

  describe('list', () => {
    it('sends GET to /api/domain-configs', () => {
      let result: DomainConfigResponse[] | undefined;
      service.list().subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${base}/api/domain-configs`);
      expect(req.request.method).toBe('GET');
      req.flush([stubConfig]);
      expect(result).toEqual([stubConfig]);
    });

    it('returns empty array when no configs exist', () => {
      let result: DomainConfigResponse[] | undefined;
      service.list().subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${base}/api/domain-configs`);
      req.flush([]);
      expect(result).toEqual([]);
    });
  });

  describe('get', () => {
    it('sends GET to /api/domain-configs/:id', () => {
      let result: DomainConfigResponse | undefined;
      service.get(42).subscribe((r) => (result = r));

      const req = httpTesting.expectOne(`${base}/api/domain-configs/42`);
      expect(req.request.method).toBe('GET');
      req.flush(stubConfig);
      expect(result).toEqual(stubConfig);
    });
  });

  describe('getBySlug', () => {
    it('sends GET to /api/domain-configs/by-slug/:slug', () => {
      let result: DomainConfigResponse | undefined;
      service.getBySlug('cybersecurity').subscribe((r) => (result = r));

      const req = httpTesting.expectOne(
        `${base}/api/domain-configs/by-slug/cybersecurity`,
      );
      expect(req.request.method).toBe('GET');
      req.flush(stubConfig);
      expect(result).toEqual(stubConfig);
    });
  });
});
