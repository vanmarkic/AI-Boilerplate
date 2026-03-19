import { Injectable, inject, signal } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  DomainConfigApiService,
  type DomainConfigResponse,
  type TerminologyMap,
} from "./domain-config-api.service";

const FALLBACK_TERMINOLOGY: TerminologyMap = {
  event: "Event",
  issue: "Issue",
  player: "Player",
  gameMaster: "Game Master",
  exercise: "Exercise",
  scenario: "Scenario",
  decision: "Decision",
};

const FALLBACK_DOMAIN: DomainConfigResponse = {
  id: 0,
  slug: "default",
  name: "Default",
  description: "",
  terminology: FALLBACK_TERMINOLOGY,
  theme: {
    colorPrimary: "#3b82f6",
    colorSecondary: "#6366f1",
    colorBackground: "#ffffff",
    colorForeground: "#1e293b",
    fontFamily: "system-ui, sans-serif",
    fontFamilyMono: "ui-monospace, monospace",
    density: "comfortable",
  },
  roles: [],
  severity_levels: [],
  created_at: "",
  updated_at: "",
};

@Injectable({ providedIn: "root" })
export class DomainService {
  private readonly api = inject(DomainConfigApiService);

  readonly activeDomain = signal<DomainConfigResponse>(FALLBACK_DOMAIN);
  readonly availableDomains = signal<DomainConfigResponse[]>([]);
  readonly loading = signal(false);

  constructor() {
    this.loadAll();
  }

  async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      const domains = await firstValueFrom(this.api.list());
      this.availableDomains.set(domains);
      const current = domains.find((d) => d.slug === this.activeDomain().slug);
      if (current) {
        this.activeDomain.set(current);
      }
    } finally {
      this.loading.set(false);
    }
  }

  async setDomain(slugOrId: string | number): Promise<void> {
    const cached = this.availableDomains().find((d) =>
      typeof slugOrId === "number" ? d.id === slugOrId : d.slug === slugOrId,
    );
    if (cached) {
      this.activeDomain.set(cached);
      this.applyTheme(cached.slug);
      return;
    }
    const fetched =
      typeof slugOrId === "number"
        ? await firstValueFrom(this.api.get(slugOrId))
        : await firstValueFrom(this.api.getBySlug(slugOrId));
    this.activeDomain.set(fetched);
    this.applyTheme(fetched.slug);
  }

  term(key: keyof TerminologyMap): string {
    return this.activeDomain().terminology[key] ?? key;
  }

  private applyTheme(slug: string): void {
    const themeAttr = `tfc-${slug}`;
    const html = document.documentElement;
    html.setAttribute("data-theme", themeAttr);
  }
}
