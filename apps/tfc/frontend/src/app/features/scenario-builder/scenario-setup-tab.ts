import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
  ButtonDirective,
  CardComponent,
  CollapsiblePanelComponent,
} from "@aspect/ui";
import {
  DomainConfigApiService,
  type DomainConfigResponse,
} from "../../core/domain-config-api.service";
import { StressOverlayComponent } from "../../shared/stress-overlay.component";
import { ScenarioBuilderStore } from "./scenario-builder.store";
import { ScenarioInitialStatesEditorComponent } from "./scenario-initial-states-editor";

@Component({
  selector: "tfc-scenario-setup-tab",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ButtonDirective,
    CardComponent,
    CollapsiblePanelComponent,
    RouterLink,
    ScenarioInitialStatesEditorComponent,
    StressOverlayComponent,
  ],
  template: `
    <!-- Section 1: Foundation Summary -->
    <section
      id="section-foundation"
      style="scroll-margin-top: var(--spacing-xl)"
    >
      <ui-card title="Foundation">
        @if (domainConfig()) {
          <div class="flex flex-col gap-sm p-sm">
            <p class="text-sm text-muted-foreground">
              {{ domainConfig()!.roles.length }} roles &middot;
              {{ domainConfig()!.systems.length }} systems &middot;
              {{ domainConfig()!.warfare_domains.length }} warfare domains
              &middot; {{ domainConfig()!.blue_card_catalog.length }} blue cards
            </p>
            <a routerLink="/foundation" class="text-sm font-medium">
              Edit Foundation &rarr;
            </a>
            <ui-collapsible-panel>
              <span panelTitle>Preview catalogs</span>
              <div class="flex flex-col gap-sm p-sm">
                <div>
                  <span class="text-sm font-medium">Roles:</span>
                  <ul class="text-sm text-muted-foreground ml-md">
                    @for (r of domainConfig()!.roles; track r.id) {
                      <li>{{ r.label }}</li>
                    }
                  </ul>
                </div>
                <div>
                  <span class="text-sm font-medium">Systems:</span>
                  <ul class="text-sm text-muted-foreground ml-md">
                    @for (s of domainConfig()!.systems; track s.id) {
                      <li>{{ s.label }} ({{ s.category }})</li>
                    }
                  </ul>
                </div>
                <div>
                  <span class="text-sm font-medium">Warfare Domains:</span>
                  <ul class="text-sm text-muted-foreground ml-md">
                    @for (d of domainConfig()!.warfare_domains; track d.id) {
                      <li>{{ d.label }}</li>
                    }
                  </ul>
                </div>
              </div>
            </ui-collapsible-panel>
          </div>
        } @else {
          <p class="text-sm text-muted-foreground p-sm">
            Loading foundation data...
          </p>
        }
      </ui-card>
    </section>

    <!-- Section 2: Scenario Metadata -->
    <section id="section-metadata" style="scroll-margin-top: var(--spacing-xl)">
      <ui-card title="Scenario Metadata">
        <div class="flex flex-col gap-md p-sm">
          <div class="flex flex-col gap-xs">
            <label class="text-sm font-medium" for="briefing">Briefing</label>
            <textarea
              id="briefing"
              class="input-base"
              rows="5"
              [value]="store.content().briefing ?? ''"
              (input)="onBriefingChange($event)"
            ></textarea>
          </div>

          <!-- Objectives -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Objectives</span>
            @for (obj of objectives(); track $index) {
              <div class="flex items-center gap-sm">
                <span
                  class="text-sm text-muted-foreground"
                  style="min-width: 1.5rem"
                >
                  {{ $index + 1 }}.
                </span>
                <input
                  class="input-base"
                  style="flex: 1"
                  [value]="obj"
                  (input)="onObjectiveChange($index, $event)"
                />
                <button
                  uiButton
                  variant="destructive"
                  size="sm"
                  (click)="removeObjective($index)"
                >
                  Remove
                </button>
              </div>
            }
            <button
              uiButton
              variant="outline"
              size="sm"
              (click)="addObjective()"
            >
              Add objective
            </button>
          </div>

          <!-- Rules -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Rules</span>
            @for (rule of rules(); track $index) {
              <div class="flex items-center gap-sm">
                <span
                  class="text-sm text-muted-foreground"
                  style="min-width: 1.5rem"
                >
                  {{ $index + 1 }}.
                </span>
                <input
                  class="input-base"
                  style="flex: 1"
                  [value]="rule"
                  (input)="onRuleChange($index, $event)"
                />
                <button
                  uiButton
                  variant="destructive"
                  size="sm"
                  (click)="removeRule($index)"
                >
                  Remove
                </button>
              </div>
            }
            <button uiButton variant="outline" size="sm" (click)="addRule()">
              Add rule
            </button>
          </div>

          <!-- Game Mode -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Game Mode</span>
            <div class="flex gap-sm">
              <button
                uiButton
                size="sm"
                [variant]="gameMode() === 'classic' ? 'default' : 'outline'"
                (click)="store.setGameMode('classic')"
              >
                Classic
              </button>
              <button
                uiButton
                size="sm"
                [variant]="
                  gameMode() === 'collaborative' ? 'default' : 'outline'
                "
                (click)="store.setGameMode('collaborative')"
              >
                Collaborative
              </button>
            </div>
          </div>

          <!-- Score Tier Thresholds -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Score Tier Thresholds</span>
            <div class="flex gap-sm items-center">
              <label class="text-sm" for="threshold-lo">Lo</label>
              <input
                id="threshold-lo"
                type="number"
                class="input-base"
                style="width: 5rem"
                [value]="thresholdLo()"
                (change)="onThresholdLoChange($event)"
              />
              <label class="text-sm" for="threshold-mid">Mid</label>
              <input
                id="threshold-mid"
                type="number"
                class="input-base"
                style="width: 5rem"
                [value]="thresholdMid()"
                (change)="onThresholdMidChange($event)"
              />
            </div>
          </div>

          <!-- Default Time Factor -->
          <div class="flex items-center gap-sm">
            <label class="text-sm font-medium" for="time-factor">
              Default Time Factor
            </label>
            <input
              id="time-factor"
              type="number"
              class="input-base"
              style="width: 5rem"
              [value]="store.content().default_time_factor"
              (change)="onTimeFactorChange($event)"
            />
          </div>

          <!-- Stress Effect Preset -->
          <div class="flex flex-col gap-xs">
            <span class="text-sm font-medium">Stress Effect</span>
            <p class="text-xs text-muted-foreground">
              Visual overlay intensity when stress approaches 10
            </p>
            <div class="flex gap-sm">
              @for (opt of stressPresetOptions; track opt.value) {
                <button
                  uiButton
                  size="sm"
                  [variant]="
                    stressEffectPreset() === opt.value ? 'default' : 'outline'
                  "
                  (click)="store.setStressEffectPreset(opt.value)"
                >
                  {{ opt.label }}
                </button>
              }
            </div>
            <button
              uiButton
              variant="outline"
              size="sm"
              [disabled]="stressEffectPreset() === 'off' || previewing()"
              (click)="startPreview()"
            >
              {{ previewing() ? "Previewing..." : "Preview" }}
            </button>
            @if (previewing()) {
              <tfc-stress-overlay
                [stress]="previewStress()"
                [preset]="stressEffectPreset()"
              />
            }
          </div>
        </div>
      </ui-card>
    </section>

    <!-- Section 3: Initial State Overrides -->
    <section
      id="section-initial-states"
      style="scroll-margin-top: var(--spacing-xl)"
    >
      <tfc-scenario-initial-states-editor [domainConfig]="domainConfig()" />
    </section>
  `,
})
export class ScenarioSetupTabComponent implements OnInit, OnDestroy {
  protected readonly store = inject(ScenarioBuilderStore);
  private readonly domainConfigApi = inject(DomainConfigApiService);

  protected readonly domainConfig = signal<DomainConfigResponse | null>(null);

  protected readonly objectives = computed(
    () => this.store.content().objectives ?? [],
  );
  protected readonly rules = computed(() => this.store.content().rules ?? []);
  protected readonly gameMode = computed(
    () => this.store.content().game_mode ?? "classic",
  );
  protected readonly thresholdLo = computed(
    () => this.store.content().score_tier_thresholds?.["lo"] ?? 0,
  );
  protected readonly thresholdMid = computed(
    () => this.store.content().score_tier_thresholds?.["mid"] ?? 0,
  );

  protected readonly stressEffectPreset = computed(
    () => this.store.content().stress_effect_preset ?? "standard",
  );

  protected readonly stressPresetOptions = [
    { value: "off" as const, label: "Off" },
    { value: "mild" as const, label: "Mild" },
    { value: "standard" as const, label: "Standard" },
    { value: "intense" as const, label: "Intense" },
  ];

  protected readonly previewStress = signal(0);
  protected readonly previewing = signal(false);
  private previewTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.domainConfigApi.getBySlug("silent-wake").subscribe({
      next: (config) => this.domainConfig.set(config),
    });
  }

  protected onBriefingChange(event: Event): void {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement) {
      this.store.setBriefing(target.value);
    }
  }

  protected addObjective(): void {
    this.store.setObjectives([...this.objectives(), ""]);
  }

  protected removeObjective(index: number): void {
    this.store.setObjectives(this.objectives().filter((_, i) => i !== index));
  }

  protected onObjectiveChange(index: number, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const updated = [...this.objectives()];
    updated[index] = target.value;
    this.store.setObjectives(updated);
  }

  protected addRule(): void {
    this.store.setRules([...this.rules(), ""]);
  }

  protected removeRule(index: number): void {
    this.store.setRules(this.rules().filter((_, i) => i !== index));
  }

  protected onRuleChange(index: number, event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const updated = [...this.rules()];
    updated[index] = target.value;
    this.store.setRules(updated);
  }

  protected onThresholdLoChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const val = parseFloat(target.value);
    if (isNaN(val)) return;
    const current = this.store.content().score_tier_thresholds ?? {};
    this.store.setScoreTierThresholds({ ...current, lo: val });
  }

  protected onThresholdMidChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const val = parseFloat(target.value);
    if (isNaN(val)) return;
    const current = this.store.content().score_tier_thresholds ?? {};
    this.store.setScoreTierThresholds({ ...current, mid: val });
  }

  protected onTimeFactorChange(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    const val = parseFloat(target.value);
    if (val > 0) this.store.setTimeFactor(val);
  }

  protected startPreview(): void {
    if (this.previewing()) return;
    this.previewing.set(true);
    this.previewStress.set(0);
    const steps = 50;
    let step = 0;
    this.previewTimer = setInterval(() => {
      step++;
      this.previewStress.set((step / steps) * 10);
      if (step >= steps) {
        this.stopPreview();
      }
    }, 100);
  }

  private stopPreview(): void {
    if (this.previewTimer) {
      clearInterval(this.previewTimer);
      this.previewTimer = null;
    }
    this.previewing.set(false);
    this.previewStress.set(0);
  }

  ngOnDestroy(): void {
    this.stopPreview();
  }
}
