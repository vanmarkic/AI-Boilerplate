import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  provideAppInitializer,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { GlobalErrorHandler } from './core/error-handler';
import { authInterceptor } from './shared/auth/auth.interceptor';
import { AuthStore } from './shared/auth/auth.store';
import { client } from './shared/api/generated/client.gen';
import { provideHeyApiClient } from './shared/api/generated/client/client.gen';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideHeyApiClient(client),
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => inject(AuthStore).init()),
  ],
};
