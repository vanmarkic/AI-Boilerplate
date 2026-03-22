import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "./environment";

export interface TerminologyMap {
  event: string;
  issue: string;
  player: string;
  gameMaster: string;
  exercise: string;
  scenario: string;
  decision: string;
}

export interface SeverityLevel {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface DomainRole {
  id: string;
  label: string;
  description: string;
}

export interface ThemeConfig {
  colorPrimary: string;
  colorSecondary: string;
  colorBackground: string;
  colorForeground: string;
  fontFamily: string;
  fontFamilyMono: string;
  density: string;
}

export interface SystemDef {
  id: string;
  label: string;
  description?: string;
  category: string;
}

export interface WarfareDomainDef {
  id: string;
  label: string;
  description?: string;
}

export interface BlueCardDef {
  id: string;
  title: string;
  description?: string;
  targets_system: boolean;
}

export interface DomainConfigResponse {
  id: number;
  slug: string;
  name: string;
  description: string;
  terminology: TerminologyMap;
  theme: ThemeConfig;
  roles: DomainRole[];
  severity_levels: SeverityLevel[];
  systems: SystemDef[];
  warfare_domains: WarfareDomainDef[];
  blue_card_catalog: BlueCardDef[];
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: "root" })
export class DomainConfigApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  list(): Observable<DomainConfigResponse[]> {
    return this.http.get<DomainConfigResponse[]>(
      `${this.base}/api/domain-configs`,
    );
  }

  get(id: number): Observable<DomainConfigResponse> {
    return this.http.get<DomainConfigResponse>(
      `${this.base}/api/domain-configs/${id}`,
    );
  }

  getBySlug(slug: string): Observable<DomainConfigResponse> {
    return this.http.get<DomainConfigResponse>(
      `${this.base}/api/domain-configs/by-slug/${slug}`,
    );
  }
}
