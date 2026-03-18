import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DomainSelectorComponent } from './domain-selector.component';
import { DomainService } from '../core/domain.service';
import type { DomainConfigResponse } from '../core/domain-config-api.service';
import { environment } from '../core/environment';

const STUB_DOMAINS: DomainConfigResponse[] = [
  {
    id: 1,
    slug: 'default',
    name: 'Default',
    description: '',
    terminology: {
      event: 'Event', issue: 'Issue', player: 'Player',
      gameMaster: 'Game Master', exercise: 'Exercise',
      scenario: 'Scenario', decision: 'Decision',
    },
    theme: {
      colorPrimary: '#3b82f6', colorSecondary: '#6366f1',
      colorBackground: '#ffffff', colorForeground: '#1e293b',
      fontFamily: 'system-ui', fontFamilyMono: 'monospace',
      density: 'comfortable',
    },
    roles: [], severity_levels: [],
    created_at: '', updated_at: '',
  },
  {
    id: 2,
    slug: 'cybersecurity',
    name: 'Cybersecurity',
    description: '',
    terminology: {
      event: 'Incident', issue: 'Vulnerability', player: 'Analyst',
      gameMaster: 'Director', exercise: 'Cyber Exercise',
      scenario: 'Attack Scenario', decision: 'Response Action',
    },
    theme: {
      colorPrimary: '#06b6d4', colorSecondary: '#8b5cf6',
      colorBackground: '#0f172a', colorForeground: '#e2e8f0',
      fontFamily: 'system-ui', fontFamilyMono: 'monospace',
      density: 'compact',
    },
    roles: [], severity_levels: [],
    created_at: '', updated_at: '',
  },
];

describe('DomainSelectorComponent', () => {
  let fixture: ComponentFixture<DomainSelectorComponent>;
  let domainService: DomainService;
  const base = environment.apiBaseUrl;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DomainSelectorComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    domainService = TestBed.inject(DomainService);
    domainService.availableDomains.set(STUB_DOMAINS);
    domainService.activeDomain.set(STUB_DOMAINS[0]);

    fixture = TestBed.createComponent(DomainSelectorComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Flush domain-configs request fired by DomainService constructor
    const httpTesting = TestBed.inject(HttpTestingController);
    httpTesting.match(`${base}/api/domain-configs`).forEach((r) => r.flush([]));
  });

  it('renders a select element', () => {
    const select = fixture.nativeElement.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('renders one option per available domain', () => {
    const options = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(STUB_DOMAINS.length);
  });

  it('defaults to the active domain slug', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('default');
  });

  it('calls setDomain when selection changes', () => {
    const spy = vi.spyOn(domainService, 'setDomain');
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = 'cybersecurity';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(spy).toHaveBeenCalledWith('cybersecurity');
  });

  it('updates selected value when domain changes programmatically', () => {
    domainService.activeDomain.set(STUB_DOMAINS[1]);
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('cybersecurity');
  });
});
