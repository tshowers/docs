import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { initializeApp } from 'firebase/app';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { docsTenantInterceptor } from './core/interceptors/docs-tenant.interceptor';
import { idTokenInterceptor } from './core/interceptors/id-token.interceptor';
import { pendingClickInterceptor } from './shared/working/pending-click.service';
import { provideCanonicalUrl } from './shared/canonical-url';
import { providePageMeta } from './shared/page-meta';

initializeApp( environment.firebaseConfig );

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideCanonicalUrl(),
    providePageMeta(),
    provideHttpClient(withInterceptors([idTokenInterceptor, docsTenantInterceptor, pendingClickInterceptor])),
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ]
};
