import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { client } from './app/shared/api/generated/client.gen';
import { environment } from './app/core/environment';

client.setConfig({ baseUrl: environment.apiBaseUrl });

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
