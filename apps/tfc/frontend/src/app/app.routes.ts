import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'join',
    pathMatch: 'full',
  },
  {
    path: 'join',
    loadChildren: () =>
      import('./features/join/join.routes').then((m) => m.JOIN_ROUTES),
  },
  {
    path: 'waiting-room',
    loadChildren: () =>
      import('./features/waiting-room/waiting-room.routes').then(
        (m) => m.WAITING_ROOM_ROUTES
      ),
  },
  {
    path: 'gm',
    loadChildren: () =>
      import('./features/game-master/game-master.routes').then(
        (m) => m.GAME_MASTER_ROUTES
      ),
  },
  {
    path: 'player',
    loadChildren: () =>
      import('./features/player/player.routes').then(
        (m) => m.PLAYER_ROUTES
      ),
  },
  {
    path: 'builder',
    loadChildren: () =>
      import('./features/scenario-builder/scenario-builder.routes').then(
        (m) => m.SCENARIO_BUILDER_ROUTES
      ),
  },
  {
    path: 'review',
    loadChildren: () =>
      import('./features/review/review.routes').then(
        (m) => m.REVIEW_ROUTES
      ),
  },
];
