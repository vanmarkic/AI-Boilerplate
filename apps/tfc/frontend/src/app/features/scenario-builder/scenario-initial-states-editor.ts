import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
} from "@angular/core";
import { CardComponent } from "@aspect/ui";
import type {
  DomainConfigResponse,
  WarfareDomainDef as DomainWarfareDef,
  SystemDef,
} from "../../core/domain-config-api.service";
import type {
  SystemStateDef,
  ScenarioWarfareDomainDef,
} from "../../core/scenario-api.service";
import { ScenarioBuilderStore } from "./scenario-builder.store";

@Component({
  selector: "tfc-scenario-initial-states-editor",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CardComponent],
  template: `
    <ui-card title="Initial State Overrides">
      <div class="flex flex-col gap-md p-sm">
        @if (domainConfig()) {
          <!-- Systems Table -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Systems</span>
            <table style="width: 100%; border-collapse: collapse">
              <thead>
                <tr class="border-b">
                  <th class="text-sm font-medium p-xs" style="text-align: left">System</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Category</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Operational State</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Power</th>
                </tr>
              </thead>
              <tbody>
                @for (sys of domainConfig()!.systems; track sys.id) {
                  <tr class="border-b">
                    <td class="text-sm p-xs">{{ sys.label }}</td>
                    <td class="text-sm p-xs">{{ sys.category }}</td>
                    <td class="p-xs">
                      <select
                        class="input-base"
                        [value]="getSystemOpState(sys.id)"
                        (change)="onSystemOpStateChange(sys.id, $event)"
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
                  <th class="text-sm font-medium p-xs" style="text-align: left">Domain</th>
                  <th class="text-sm font-medium p-xs" style="text-align: left">Threat Level</th>
                </tr>
              </thead>
              <tbody>
                @for (dom of domainConfig()!.warfare_domains; track dom.id) {
                  <tr class="border-b">
                    <td class="text-sm p-xs">{{ dom.label }}</td>
                    <td class="p-xs">
                      <select
                        class="input-base"
                        [value]="getDomainThreatLevel(dom.id)"
                        (change)="onDomainThreatChange(dom.id, dom.label, $event)"
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

  // --- System State Overrides ---
  protected getSystemOpState(systemId: string): string {
    const states = this.store.content().initial_system_states ?? [];
    const found = states.find((s) => s.system_id === systemId);
    return found?.operational_state ?? "green";
  }

  protected getSystemPower(systemId: string): string {
    const states = this.store.content().initial_system_states ?? [];
    const found = states.find((s) => s.system_id === systemId);
    return String(found?.power_state ?? true);
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
    } else {
      states.push({
        system_id: systemId,
        operational_state: "green",
        power_state: true,
        ...updates,
      });
    }
    this.store.setInitialSystemStates(states);
  }

  // --- Warfare Domain Overrides ---
  protected getDomainThreatLevel(domainId: string): string {
    const domains = this.store.content().initial_warfare_domains ?? [];
    const found = domains.find((d) => d.domain_id === domainId);
    return found?.initial_threat_level ?? "green";
  }

  protected onDomainThreatChange(
    domainId: string,
    label: string,
    event: Event,
  ): void {
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
    } else {
      domains.push({
        domain_id: domainId,
        label,
        initial_threat_level: target.value,
      });
    }
    this.store.setInitialWarfareDomains(domains);
  }
}
