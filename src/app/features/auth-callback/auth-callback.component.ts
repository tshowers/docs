import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsSignupDraftService } from '../../services/docs-signup-draft.service';
import { GettingStartedService } from '../../services/getting-started.service';

/**
 * Lands here after TODD's hosted login (todd.taliferro.tech/login) hands
 * a signed-in session back to this app: ?token=<custom token>&state=<...>.
 * Verifies `state` against what signIn() stashed before leaving (a forged
 * or replayed callback won't have a matching sessionStorage entry),
 * redeems the token, then continues to wherever the user was headed.
 * Shared by both the Docs and Knowledge route trees - one hosted-login
 * client (`docs-web`) covers both.
 */
@Component( {
  selector: 'app-auth-callback',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-callback.component.html',
  styleUrl: './auth-callback.component.css',
} )
export class AuthCallbackComponent implements OnInit {
  errorMessage = '';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: DocsAuthService,
    private signupDraft: DocsSignupDraftService,
    private gettingStarted: GettingStartedService,
  ) { }

  async ngOnInit (): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get( 'token' );
    const state = this.route.snapshot.queryParamMap.get( 'state' );
    const pending = this.authService.consumePendingLogin( state );

    if ( !token || !pending ) {
      this.errorMessage = 'This sign-in link is invalid or expired. Please try signing in again.';
      return;
    }

    try {
      await this.authService.signInWithCustomToken( token );

      // Came through /get-started: save name/company to the profile and
      // the Q&A answer they wrote, then show it in the Knowledge Base -
      // carrying the "already wrote it" momentum through the sign-in wall.
      if ( await this.signupDraft.submitIfPending() ) {
        await this.router.navigateByUrl( '/knowledge' );
        return;
      }

      const returnUrl = pending.returnUrl || '/docs';
      // Heading to the default landing (not a deep link) and steps remain:
      // show the Getting Started checklist first, once per session.
      if ( ( returnUrl === '/docs' || returnUrl === '/' ) && await this.gettingStarted.shouldShowAfterSignIn() ) {
        await this.router.navigate( ['/help'], { fragment: 'your-progress' } );
        return;
      }
      await this.router.navigateByUrl( returnUrl );
    } catch ( error: any ) {
      this.errorMessage = error?.message || 'Sign-in failed. Please try again.';
    }
  }
}
