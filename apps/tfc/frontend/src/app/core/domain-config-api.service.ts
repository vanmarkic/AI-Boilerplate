import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "./environment";
import type {
  TerminologyMap,
  ThemeConfig,
  DomainRole,
  SeverityLevel,
} from "@aspect/tfc-shared";

export interface DomainConfigResponse {
  id: number;
  slug: string;
  name: string;
  description: string;
  terminology: TerminologyMap;
  theme: ThemeConfig;
  roles: DomainRole[];
  severity_levels: SeverityLevel[];
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
