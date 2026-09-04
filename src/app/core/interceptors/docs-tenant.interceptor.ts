import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { DocsAuthService } from '../../services/docs-auth.service';

/**
 * Ported from taliferrotech's core/interceptors/tenant.interceptor.ts.
 * Unlike web-products/network - which only ever talks to Firestore
 * directly (NetworkDataService) or to endpoints that build headers by
 * hand (AccountBillingService) - Docs's DocService/ResponseFlowService
 * are plain HttpClient calls against `${backendURL}/docs` and
 * `${backendURL}/response-flows` with no per-request auth headers of
 * their own, exactly like the monorepo originals. This interceptor is
 * what makes that work: it attaches x-tenant-id/x-user-id/x-user-email
 * to every request that hits the backend API, same as the monorepo's
 * global tenantInterceptor did for them there.
 */
function isBackendApiRequest ( url: string ): boolean {
  return url.includes( '/api/' );
}

export const docsTenantInterceptor: HttpInterceptorFn = ( req, next ) => {
  if ( !isBackendApiRequest( req.url ) ) {
    return next( req );
  }

  const authService = inject( DocsAuthService );
  const tenantId = authService.getTenantIdSync();
  const userId = authService.getCurrentUserIdSync();
  const userEmail = authService.getCurrentUserEmailSync();

  if ( !tenantId || !userId ) {
    return next( req );
  }

  const cloned = req.clone( {
    setHeaders: {
      'X-Tenant-Id': tenantId,
      'X-User-Id': userId,
      'X-User-Email': userEmail,
    }
  } );

  return next( cloned );
};
