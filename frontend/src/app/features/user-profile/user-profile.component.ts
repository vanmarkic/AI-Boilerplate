import { Component, inject } from '@angular/core';
import { UserProfileStore } from './user-profile.store';

@Component({
  selector: 'app-user-profile',
  template: `
    @if (store.loading()) {
      <p>Loading...</p>
    } @else if (store.error(); as error) {
      <p class="error">{{ error }}</p>
    } @else if (store.item(); as user) {
      <h1>{{ user.name }}</h1>
      <p>{{ user.email }}</p>
    }
  `,
})
export class UserProfileComponent {
  protected readonly store = inject(UserProfileStore);
}
