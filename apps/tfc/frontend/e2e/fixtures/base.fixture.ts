/**
 * Shared Playwright fixtures for TFC e2e tests.
 *
 * Provides API route mocking helpers so tests run without a live backend.
 */
import { test as base, type Page, type Route } from '@playwright/test';

/** Shape returned by POST /waiting-room/join */
export interface MockParticipant {
  id: string;
  display_name: string;
  role: string;
  joined_at: string;
}

let participantCounter = 0;

/** Build a mock participant object. */
export function mockParticipant(
  overrides: Partial<MockParticipant> = {},
): MockParticipant {
  participantCounter += 1;
  return {
    id: `p-${participantCounter}-${Date.now()}`,
    display_name: overrides.display_name ?? 'TestUser',
    role: overrides.role ?? 'player',
    joined_at: new Date().toISOString(),
    ...overrides,
  };
}

type Fixtures = {
  /** Intercept all waiting-room API calls with configurable responses. */
  mockApi: MockApi;
};

export class MockApi {
  /** Accumulated participants per exercise_id (mirrors server state). */
  readonly rooms = new Map<number, MockParticipant[]>();

  constructor(private readonly page: Page) {}

  /** Install default API route handlers. Call once per test. */
  async install(): Promise<void> {
    // POST /api/exercises — create exercise
    await this.page.route('**/api/exercises', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }
      const body = route.request().postDataJSON();
      const id = Math.floor(Math.random() * 9000) + 1000;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id,
          title: body.title ?? 'Test Exercise',
          description: body.description ?? '',
          phase: 'setup',
          scenario_id: null,
          time_factor: 1.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    });

    // POST /waiting-room/join
    await this.page.route('**/waiting-room/join', async (route) => {
      const url = route.request().url();
      const exerciseId = this.extractExerciseId(url);
      const body = route.request().postDataJSON();
      const p = mockParticipant({
        display_name: body.display_name,
        role: body.role ?? 'player',
      });
      this.addParticipant(exerciseId, p);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(p),
      });
    });

    // GET /waiting-room
    await this.page.route('**/waiting-room', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      const exerciseId = this.extractExerciseId(url);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          exercise_id: exerciseId,
          participants: this.rooms.get(exerciseId) ?? [],
        }),
      });
    });

    // PUT /participants/:id/role
    await this.page.route('**/participants/*/role', async (route) => {
      if (route.request().method() !== 'PUT') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      const exerciseId = this.extractExerciseId(url);
      const participantId = this.extractParticipantId(url);
      const body = route.request().postDataJSON();
      const p = this.updateRole(exerciseId, participantId, body.role);
      if (!p) {
        await route.fulfill({ status: 404 });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(p),
      });
    });

    // DELETE /participants/:id
    await this.page.route('**/waiting-room/participants/*', async (route) => {
      if (route.request().method() !== 'DELETE') {
        await route.fallback();
        return;
      }
      const url = route.request().url();
      const exerciseId = this.extractExerciseId(url);
      const participantId = this.extractParticipantId(url);
      const removed = this.removeParticipant(exerciseId, participantId);
      await route.fulfill({ status: removed ? 204 : 404 });
    });

    // Swallow WebSocket upgrade attempts (no real server)
    await this.page.route('**/ws?*', (route) =>
      route.abort('connectionrefused'),
    );
    await this.page.route('**/ws', (route) =>
      route.abort('connectionrefused'),
    );
  }

  /** Seed the room with participants before navigating. */
  seed(exerciseId: number, participants: MockParticipant[]): void {
    this.rooms.set(exerciseId, [...participants]);
  }

  private addParticipant(exerciseId: number, p: MockParticipant): void {
    const list = this.rooms.get(exerciseId) ?? [];
    list.push(p);
    this.rooms.set(exerciseId, list);
  }

  private updateRole(
    exerciseId: number,
    participantId: string,
    role: string,
  ): MockParticipant | null {
    const list = this.rooms.get(exerciseId) ?? [];
    const p = list.find((x) => x.id === participantId);
    if (!p) return null;
    p.role = role;
    return p;
  }

  private removeParticipant(
    exerciseId: number,
    participantId: string,
  ): boolean {
    const list = this.rooms.get(exerciseId) ?? [];
    const idx = list.findIndex((x) => x.id === participantId);
    if (idx === -1) return false;
    list.splice(idx, 1);
    return true;
  }

  private extractExerciseId(url: string): number {
    const m = url.match(/exercises\/(\d+)/);
    return m ? Number(m[1]) : 0;
  }

  private extractParticipantId(url: string): string {
    const m = url.match(/participants\/([^/]+)/);
    return m ? m[1] : '';
  }
}

export const test = base.extend<Fixtures>({
  mockApi: async ({ page }, use) => {
    const api = new MockApi(page);
    await use(api);
  },
});

export { expect } from '@playwright/test';
