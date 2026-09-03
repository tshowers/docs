import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AfterViewInit, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsEntitlementService } from '../../services/docs-entitlement.service';
import { DocsDataService } from '../../services/docs-data.service';
import { DocsPurchaseFlowService } from '../../services/docs-purchase-flow.service';
import { KNOWLEDGE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { Product } from '../../models/product.model';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

const DEFAULT_PRICE = '$9/month';
const DEFAULT_HIGHLIGHTS = [
  'Save and reuse knowledge inside TODD.',
  'Keep building response flows and structured knowledge entries.',
  'Turn what your team knows into something people can use again.'
];
const DEFAULT_NOTES = [
  'Free access includes up to 2 knowledge entries.',
  'The paid plan removes the free-entry wall so you can keep building.',
  'Use Knowledge when you want answers, guidance, and reusable structure in one place.'
];

/**
 * Ported from features/knowledge/knowledge-pricing/knowledge-pricing.component.ts,
 * trimmed the same way as DocsPricingComponent - ToddAssistantBusService's
 * signal-state subscription dropped, checkout flow unchanged.
 */
@Component( {
  selector: 'app-knowledge-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ClickSoundDirective],
  templateUrl: './knowledge-pricing.component.html',
  styleUrl: './knowledge-pricing.component.css'
} )
export class KnowledgePricingComponent implements OnInit, OnDestroy, AfterViewInit {
  readonly entitlements$ = inject( DocsEntitlementService ).getEntitlements();
  private readonly purchaseFlowConfig = KNOWLEDGE_PURCHASE_FLOW;
  private authService = inject( DocsAuthService );
  private router = inject( Router );
  private dataService = inject( DocsDataService );

  tenantIdSubscription!: Subscription;
  userSubscription!: Subscription;

  private tenantProduct: Product | null = null;

  email = '';
  tenantId = '';
  isStartingCheckout = false;
  checkoutError = '';
  requiresLogin = false;

  get monthlyPrice (): string {
    return this.tenantProduct?.priceLabel || DEFAULT_PRICE;
  }

  get highlights (): string[] {
    const d = this.tenantProduct?.shortDescription;
    return d ? [d] : DEFAULT_HIGHLIGHTS;
  }

  get notes (): string[] {
    const d = this.tenantProduct?.description;
    return d ? [d] : DEFAULT_NOTES;
  }

  constructor (
    private purchaseFlowService: DocsPurchaseFlowService
  ) { }

  ngOnInit (): void {
    this.userSubscription = this.authService.getUser().subscribe( firebaseUser => {
      this.email = firebaseUser?.email || '';
      this.requiresLogin = !firebaseUser;
    } );

    this.tenantIdSubscription = this.authService.getTenantId().subscribe( async tenantId => {
      this.tenantId = tenantId || '';
      if ( this.tenantId ) {
        await this.loadTenantProduct( 'knowledge' );
      }
    } );
  }

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
  }

  ngOnDestroy (): void {
    if ( this.userSubscription ) this.userSubscription.unsubscribe();
    if ( this.tenantIdSubscription ) this.tenantIdSubscription.unsubscribe();
  }

  goToLogin (): void {
    void this.purchaseFlowService.goToLogin( this.router, this.purchaseFlowConfig );
  }

  private async loadTenantProduct ( productName: string ): Promise<void> {
    try {
      const contact = await this.dataService.getContact( this.tenantId, this.tenantId );
      const products: Product[] = ( contact as any )?.company?.products || [];
      this.tenantProduct = products.find(
        p => p.active !== false && p.discontinued !== true &&
             p.name?.toLowerCase().includes( productName )
      ) || null;
    } catch {
      this.tenantProduct = null;
    }
  }

  async startCheckout (): Promise<void> {
    this.checkoutError = '';
    this.requiresLogin = !this.email;

    if ( this.requiresLogin ) {
      this.checkoutError = 'Please sign in before purchasing Knowledge access.';
      return;
    }

    const tenantId = this.tenantId.trim();
    const email = this.email.trim().toLowerCase();

    if ( !tenantId ) {
      this.checkoutError = 'We could not find you. Please sign in again and try once more.';
      return;
    }

    if ( !email ) {
      this.checkoutError = 'Email is required before checkout.';
      return;
    }

    this.isStartingCheckout = true;

    try {
      const checkoutUrl = await this.purchaseFlowService.startCheckout(
        this.purchaseFlowConfig,
        {
          tenantId,
          email,
          priceId: this.tenantProduct?.stripePriceIdMonthly || ''
        },
        'Unable to start Knowledge checkout.'
      );

      this.purchaseFlowService.redirectToCheckout( checkoutUrl );
    } catch ( error: any ) {
      this.checkoutError = error?.message || 'Unable to start Knowledge checkout.';
      this.isStartingCheckout = false;
    }
  }
}
