import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DocsAuthService } from '../../services/docs-auth.service';
import { firstValueFrom } from 'rxjs';

/**
 * Ported from web-products/network's SignInComponent (itself ported from
 * 16Ahead's own sign-in page). Sign-in doesn't happen natively in this app -
 * it redirects to 16Ahead's hosted login (app.16ahead.com/login) instead
 * of rendering its own Google/Apple/email-link buttons. See
 * DocsAuthService.signIn() for the handoff. Shared by both the Docs and
 * Knowledge route trees.
 */
@Component( {
  selector: 'app-sign-in',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.css',
} )
export class SignInComponent implements OnInit {
  isSigningIn = false;

  private returnUrl = '/';

  constructor (
    private route: ActivatedRoute,
    private router: Router,
    private authService: DocsAuthService,
  ) { }

  async ngOnInit (): Promise<void> {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/';
    if ( await firstValueFrom( this.authService.getUser() ) ) {
      await this.router.navigateByUrl( this.returnUrl );
      return;
    }
    this.signIn();
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
