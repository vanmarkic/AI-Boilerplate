import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from './environment';

export interface CreateExerciseRequest {
  title: string;
  description?: string;
  phase?: string;
  scenario_id?: number | null;
  domain_id?: number | null;
  time_factor?: number;
  game_mode?: string;
}

export interface ExerciseResponse {
  id: number;
  title: string;
  description: string;
  phase: string;
  scenario_id: number | null;
  domain_id: number | null;
  time_factor: number;
  game_mode: string;
  session_code: string;
  created_at: string;
  updated_at: string;
}

@Injectable({ providedIn: 'root' })
export class ExerciseApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  create(request: CreateExerciseRequest): Observable<ExerciseResponse> {
    return this.http.post<ExerciseResponse>(`${this.base}/api/exercises`, request);
  }

  list(phase?: string): Observable<ExerciseResponse[]> {
    const params: Record<string, string> = {};
    if (phase) params['phase'] = phase;
    return this.http.get<ExerciseResponse[]>(`${this.base}/api/exercises`, { params });
  }

  get(id: number): Observable<ExerciseResponse> {
    return this.http.get<ExerciseResponse>(`${this.base}/api/exercises/${id}`);
  }
}
