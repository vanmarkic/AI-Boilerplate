import { Component, inject } from '@angular/core';
import { UserProfileService } from './user-profile.service';

@Component({
  selector: 'app-user-profile',
  template: `
    @if (service.loading()) {
      <p>Loading...</p>
    } @else if (service.error(); as error) {
      <p class="error">{{ error }}</p>
    } @else if (service.user(); as user) {
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
    }
  `,
})
export class UserProfileComponent {
  protected readonly service = inject(UserProfileService);
}
