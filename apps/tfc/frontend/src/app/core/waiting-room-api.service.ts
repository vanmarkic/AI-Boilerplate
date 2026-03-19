import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "./environment";

export interface ParticipantResponse {
  id: string;
  display_name: string;
  role: string;
  joined_at: string;
}

export interface WaitingRoomResponse {
  exercise_id: number;
  participants: ParticipantResponse[];
}

@Injectable({ providedIn: "root" })
export class WaitingRoomApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  join(
    exerciseId: number,
    displayName: string,
    role: string,
  ): Observable<ParticipantResponse> {
    return this.http.post<ParticipantResponse>(
      `${this.base}/api/exercises/${exerciseId}/waiting-room/join`,
      { display_name: displayName, role },
    );
  }

  listParticipants(exerciseId: number): Observable<WaitingRoomResponse> {
    return this.http.get<WaitingRoomResponse>(
      `${this.base}/api/exercises/${exerciseId}/waiting-room`,
    );
  }

  updateRole(
    exerciseId: number,
    participantId: string,
    role: string,
  ): Observable<ParticipantResponse> {
    return this.http.put<ParticipantResponse>(
      `${this.base}/api/exercises/${exerciseId}/waiting-room/participants/${participantId}/role`,
      { role },
    );
  }

  leave(exerciseId: number, participantId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/api/exercises/${exerciseId}/waiting-room/participants/${participantId}`,
    );
  }

  close(exerciseId: number, participantId: string): Observable<void> {
    return this.http.post<void>(
      `${this.base}/api/exercises/${exerciseId}/waiting-room/close`,
      { participant_id: participantId },
    );
  }
}
