import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsPurchaseFlowService } from '../../services/docs-purchase-flow.service';
import { DOCS_PURCHASE_FLOW, KNOWLEDGE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';

/**
 * Payment success (design_handoff_todd_docs 3h): one page for
 * /docs/success and /knowledge/success (route data `flow`). Confirms the
 * Stripe checkout session first, as before; "View receipt" is left out
 * because the confirmation doesn't return a receipt link.
 */
@Component( {
  selector: 'app-payment-success',
  standalone: true,
  imports: [RouterModule, DkIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .ps { max-width: 640px; margin: 0 auto; padding: 56px 24px; text-align: center; font-family: var(--font); color: var(--text); }
    .ps__mark { display: grid; place-items: center; width: 88px; height: 88px; margin: 0 auto 22px; border-radius: 50%; }
    .ps h1 { margin: 0 0 12px; font-size: 44px; font-weight: 700; line-height: 1.05; letter-spacing: -0.04em; }
    .ps p { margin: 0 auto 26px; max-width: 460px; font-size: 16px; line-height: 1.6; color: var(--muted); }
    .ps__pulse { animation: ps-pulse 1.4s ease-in-out infinite; }
    @keyframes ps-pulse { 50% { opacity: .45; } }
    @media (prefers-reduced-motion: reduce) { .ps__pulse { animation: none; } }
    @media (max-width: 760px) { .ps { padding-top: 24px; } .ps h1 { font-size: 32px; } }
  `],
  template: `
    <div class="ps" data-cy="payment-success">
      @switch (state()) {
        @case ('confirming') {
          <span class="ps__mark dk-tinted ps__pulse" data-tint="blue"><dk-icon name="clock" [size]="36" /></span>
          <h1>Confirming your payment…</h1>
          <p>Checking your checkout with Stripe so your new limits can switch on.</p>
        }
        @case ('done') {
          <span class="ps__mark dk-tinted" data-tint="green"><dk-icon name="check" [size]="40" /></span>
          <h1>Payment received. Thank you.</h1>
          <p>Your new limits are on now.@if (email()) { A receipt is on its way to {{ email() }}.}</p>
          <a class="dk-btn dk-btn--primary dk-btn--lg" [routerLink]="backRoute">{{ backLabel }} →</a>
        }
        @default {
          <span class="ps__mark dk-tinted" data-tint="pink"><dk-icon name="alert-circle" [size]="40" /></span>
          <h1>We couldn't confirm your payment</h1>
          <p>{{ error() }} If you were charged, your access will switch on shortly; contact us if it doesn't.</p>
          <a class="dk-btn dk-btn--lg" [routerLink]="backRoute">{{ backLabel }} →</a>
        }
      }
    </div>
  `,
} )
export class PaymentSuccessComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly purchase = inject( DocsPurchaseFlowService );
  private readonly auth = inject( DocsAuthService );

  private readonly flow = this.route.snapshot.data['flow'] === 'knowledge' ? KNOWLEDGE_PURCHASE_FLOW : DOCS_PURCHASE_FLOW;
  readonly backRoute = this.flow.postConfirmRoute;
  readonly backLabel = this.route.snapshot.data['flow'] === 'knowledge' ? 'Back to Knowledge' : 'Back to Docs';

  readonly state = signal<'confirming' | 'done' | 'error'>( 'confirming' );
  readonly error = signal( '' );
  readonly email = signal( '' );

  async ngOnInit (): Promise<void> {
    firstValueFrom( this.auth.getUser() ).then( ( user ) => this.email.set( String( user?.email || '' ) ) ).catch( () => null );
    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();
    if ( !sessionId ) {
      this.error.set( 'The link is missing its checkout session.' );
      this.state.set( 'error' );
      return;
    }
    try {
      await this.purchase.confirmCheckout( this.flow, sessionId );
      this.state.set( 'done' );
    } catch ( err: any ) {
      this.error.set( err?.message || 'Something went wrong confirming your purchase.' );
      this.state.set( 'error' );
    }
  }
}
