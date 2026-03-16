import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CardComponent,
  InputComponent,
  ButtonDirective,
} from '@aspect/ui';

@Component({
  selector: 'tfc-join-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CardComponent, InputComponent, ButtonDirective],
  template: `
    <div class="flex justify-center items-center min-h-screen p-lg">
      <ui-card title="Join Exercise">
        <div class="flex flex-col gap-md" style="min-width: 320px;">
          <ui-input
            id="session-code"
            label="Session Code"
            placeholder="Enter session code"
            [(value)]="sessionCode"
          />

          <ui-input
            id="display-name"
            label="Display Name"
            placeholder="Enter your name"
            [(value)]="displayName"
          />

          <div class="flex flex-col gap-sm">
            <label class="text-sm font-medium">Role</label>
            <select
              class="input-base"
              [value]="selectedRole()"
              (change)="onRoleChange($event)"
            >
              <option value="player">Player</option>
              <option value="observer">Observer</option>
            </select>
          </div>

          <button
            uiButton
            variant="default"
            (click)="onJoin()"
            [disabled]="!canJoin()"
          >
            Join
          </button>
        </div>
      </ui-card>
    </div>
  `,
})
export class JoinView {
  protected readonly sessionCode = signal('');
  protected readonly displayName = signal('');
  protected readonly selectedRole = signal<'player' | 'observer'>('player');

  protected canJoin(): boolean {
    return this.sessionCode().trim().length > 0
      && this.displayName().trim().length > 0;
  }

  protected onRoleChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as 'player' | 'observer';
    this.selectedRole.set(value);
  }

  protected onJoin(): void {
    // TODO: navigate to player/gm view based on role after joining session
  }
}
