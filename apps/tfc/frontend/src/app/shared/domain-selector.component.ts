import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DomainService } from '../core/domain.service';

@Component({
  selector: 'tfc-domain-selector',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <select
      class="input-base"
      [value]="domain.activeDomain().id"
      (change)="onDomainChange($event)">
      @for (d of domain.availableDomains; track d.id) {
        <option [value]="d.id" [selected]="d.id === domain.activeDomain().id">
          {{ d.name }}
        </option>
      }
    </select>
  `,
  host: { class: 'domain-selector' },
})
export class DomainSelectorComponent {
  protected readonly domain = inject(DomainService);

  protected onDomainChange(event: Event): void {
    const id = (event.target as HTMLSelectElement).value;
    this.domain.setDomain(id);
  }
}
