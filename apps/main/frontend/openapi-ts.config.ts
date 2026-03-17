import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: '../../../shared/openapi.json',
  output: 'src/app/shared/api/generated',
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    '@hey-api/client-angular',
    // Uncomment when Angular's httpResource() stabilizes and supports mutations:
    // { name: '@angular/common', httpResources: true },
  ],
});
