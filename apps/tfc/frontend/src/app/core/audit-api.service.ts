import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface AuditEntry {
  id: number;
  exercise_id: number;
  entry_type: string;
  action: string;
  actor_id: string | null;
  actor_name: string | null;
  target_type: string | null;
  target_id: string | null;
  play_time_ms: number;
  real_time_ms: number;
  details: Record<string, unknown> | null;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  getLog(exerciseId: number, entryType?: string): Observable<AuditEntry[]> {
    let url = `${this.base}/api/audit/${exerciseId}`;
    if (entryType) url += `?entry_type=${entryType}`;
    return this.http.get<AuditEntry[]>(url);
  }
}
