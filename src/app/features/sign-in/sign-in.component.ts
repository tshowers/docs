import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DocsAuthService } from '../../services/docs-auth.service';

/**
 * Ported from web-products/network's SignInComponent (itself ported from
 * TODD's own sign-in page). Sign-in doesn't happen natively in this app -
 * it redirects to TODD's hosted login (todd.taliferro.tech/login) instead
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

  private returnUrl = '/docs';

  constructor (
    private route: ActivatedRoute,
    private authService: DocsAuthService,
  ) { }

  ngOnInit (): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '/docs';
    this.signIn();
  }

  signIn (): void {
    this.isSigningIn = true;
    this.authService.signIn( this.returnUrl );
  }
}
