import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs/operators';
import { DocsAuthService } from './docs-auth.service';

export const landingRedirectGuard: CanActivateFn = () => {
  const authService = inject( DocsAuthService );
  const router = inject( Router );

  return authService.isLoggedIn().pipe(
    take( 1 ),
    map( isLoggedIn => isLoggedIn ? router.createUrlTree( ['/docs'] ) : true ),
  );
};
