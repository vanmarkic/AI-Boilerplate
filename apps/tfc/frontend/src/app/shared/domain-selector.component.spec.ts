import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DomainSelectorComponent } from './domain-selector.component';
import { DomainService } from '../core/domain.service';

describe('DomainSelectorComponent', () => {
  let fixture: ComponentFixture<DomainSelectorComponent>;
  let domainService: DomainService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DomainSelectorComponent],
    }).compileComponents();

    domainService = TestBed.inject(DomainService);
    fixture = TestBed.createComponent(DomainSelectorComponent);
    fixture.detectChanges();
  });

  it('renders a select element', () => {
    const select = fixture.nativeElement.querySelector('select');
    expect(select).toBeTruthy();
  });

  it('renders one option per available domain', () => {
    const options = fixture.nativeElement.querySelectorAll('option');
    expect(options.length).toBe(domainService.availableDomains.length);
  });

  it('defaults to the active domain', () => {
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
    domainService.setDomain('military');
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('military');
  });
});
