import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { CardComponent } from "@aspect/ui";
import type { DomainConfigResponse } from "../../core/domain-config-api.service";
import type { SystemStateDef } from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-initial-states-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <ui-card title="Initial States (select which systems and domains this scenario uses)">
      <div class="flex flex-col gap-md p-sm">
        @if (domainConfig()) {
          <!-- Systems Table -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Systems</span>
            <table style="width: 100%; border-collapse: collapse">
              <thead>
                <tr class="border-b">
                  <th class="text-sm font-medium p-xs" style="text-align: center; width: 2.5rem">Use</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">System</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Category</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Operational State</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Power</th>
                </tr>
              </thead>
              <tbody>
                @for (sys of domainConfig()!.systems; track sys.id) {
                  <tr class="border-b" [style.opacity]="isSystemIncluded(sys.id) ? '1' : '0.4'">
                    <td class="p-xs" style="text-align: center">
                      <input
                        type="checkbox"
                        [checked]="isSystemIncluded(sys.id)"
                        (change)="toggleSystem(sys.id)"
                      />
                    </td>
                    <td class="text-sm p-xs">{{ sys.label }}</td>
                    <td class="text-sm p-xs">{{ sys.category }}</td>
                    <td class="p-xs">
                      <select
                        class="input-base"
                        [value]="getSystemOpState(sys.id)"
                        (change)="onSystemOpStateChange(sys.id, $event)"
                        [disabled]="!isSystemIncluded(sys.id)"
                      >
                        <option value="green">Green</option>
                        <option value="yellow">Yellow</option>
                        <option value="red">Red</option>
                      </select>
                    </td>
                    <td class="p-xs">
                      <select
                        class="input-base"
                        [value]="getSystemPower(sys.id)"
                        (change)="onSystemPowerChange(sys.id, $event)"
                        [disabled]="!isSystemIncluded(sys.id)"
                      >
                        <option value="true">ON</option>
                        <option value="false">OFF</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Warfare Domains Table -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Warfare Domains</span>
            <table style="width: 100%; border-collapse: collapse">
              <thead>
                <tr class="border-b">
                  <th class="text-sm font-medium p-xs" style="text-align: center; width: 2.5rem">Use</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Domain</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Threat Level</th>
                </tr>
              </thead>
              <tbody>
                @for (dom of domainConfig()!.warfare_domains; track dom.id) {
                  <tr class="border-b" [style.opacity]="isDomainIncluded(dom.id) ? '1' : '0.4'">
                    <td class="p-xs" style="text-align: center">
                      <input
                        type="checkbox"
                        [checked]="isDomainIncluded(dom.id)"
                        (change)="toggleDomain(dom.id, dom.label)"
                      />
                    </td>
                    <td class="text-sm p-xs">{{ dom.label }}</td>
                    <td class="p-xs">
                      <select
                        class="input-base"
                        [value]="getDomainThreatLevel(dom.id)"
                        (change)="onDomainThreatChange(dom.id, $event)"
                        [disabled]="!isDomainIncluded(dom.id)"
                      >
                        <option value="green">Green</option>
                        <option value="red">Red</option>
                      </select>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        } @else {
          <p class="text-sm text-muted-foreground">
            Loading foundation data...
          </p>
        }
      </div>
    </ui-card>
  `,
})
export class ScenarioInitialStatesEditorComponent {
  protected readonly store = inject(ScenarioBuilderStore);
  readonly domainConfig = input<DomainConfigResponse | null>(null);

  // --- System inclusion (subset selection) ---
  protected isSystemIncluded(systemId: string): boolean {
    const states = this.store.content().initial_system_states ?? [];
    return states.some((s) => s.system_id === systemId);
  }

  protected toggleSystem(systemId: string): void {
    const states = [...(this.store.content().initial_system_states ?? [])];
    const idx = states.findIndex((s) => s.system_id === systemId);
    if (idx >= 0) {
      states.splice(idx, 1);
    } else {
      states.push({
        system_id: systemId,
        operational_state: "green",
        power_state: false,
      });
    }
    this.store.setInitialSystemStates(states);
  }

  // --- System state configuration ---
  protected getSystemOpState(systemId: string): string {
    const states = this.store.content().initial_system_states ?? [];
    const found = states.find((s) => s.system_id === systemId);
    return found?.operational_state ?? "green";
  }

  protected getSystemPower(systemId: string): string {
    const states = this.store.content().initial_system_states ?? [];
    const found = states.find((s) => s.system_id === systemId);
    return String(found?.power_state ?? false);
  }

  protected onSystemOpStateChange(systemId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.updateSystemState(systemId, { operational_state: target.value });
  }

  protected onSystemPowerChange(systemId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    this.updateSystemState(systemId, {
      power_state: target.value === "true",
    });
  }

  private updateSystemState(
    systemId: string,
    updates: Partial<SystemStateDef>,
  ): void {
    const states = [...(this.store.content().initial_system_states ?? [])];
    const idx = states.findIndex((s) => s.system_id === systemId);
    if (idx >= 0) {
      states[idx] = { ...states[idx], ...updates };
    }
    this.store.setInitialSystemStates(states);
  }

  // --- Warfare domain inclusion (subset selection) ---
  protected isDomainIncluded(domainId: string): boolean {
    const domains = this.store.content().initial_warfare_domains ?? [];
    return domains.some((d) => d.domain_id === domainId);
  }

  protected toggleDomain(domainId: string, label: string): void {
    const domains = [
      ...(this.store.content().initial_warfare_domains ?? []),
    ];
    const idx = domains.findIndex((d) => d.domain_id === domainId);
    if (idx >= 0) {
      domains.splice(idx, 1);
    } else {
      domains.push({
        domain_id: domainId,
        label,
        initial_threat_level: "green",
      });
    }
    this.store.setInitialWarfareDomains(domains);
  }

  // --- Warfare domain configuration ---
  protected getDomainThreatLevel(domainId: string): string {
    const domains = this.store.content().initial_warfare_domains ?? [];
    const found = domains.find((d) => d.domain_id === domainId);
    return found?.initial_threat_level ?? "green";
  }

  protected onDomainThreatChange(domainId: string, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const domains = [
      ...(this.store.content().initial_warfare_domains ?? []),
    ];
    const idx = domains.findIndex((d) => d.domain_id === domainId);
    if (idx >= 0) {
      domains[idx] = {
        ...domains[idx],
        initial_threat_level: target.value,
      };
    }
    this.store.setInitialWarfareDomains(domains);
  }
}
