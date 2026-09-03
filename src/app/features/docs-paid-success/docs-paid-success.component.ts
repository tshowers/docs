import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocsPurchaseFlowService } from '../../services/docs-purchase-flow.service';
import { DOCS_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

/**
 * Ported from features/document/docs-paid-success/docs-paid-success.component.ts,
 * trimmed the same way web-products/network's PaidSuccessComponent trims
 * features/contact/network-paid-success: ToddAssistantBusService's signal-
 * state subscription (a TODD-shell-wide affordance this app doesn't carry)
 * is dropped, along with the AfterViewInit/OnDestroy lifecycle that existed
 * only to drive it.
 */
@Component( {
  selector: 'app-docs-paid-success',
  standalone: true,
  imports: [CommonModule, RouterLink, ClickSoundDirective],
  templateUrl: './docs-paid-success.component.html',
  styleUrl: './docs-paid-success.component.css'
} )
export class DocsPaidSuccessComponent implements OnInit {
  private readonly purchaseFlowConfig = DOCS_PURCHASE_FLOW;
  private route = inject( ActivatedRoute );
  private router = inject( Router );

  isConfirming = true;
  isSuccess = false;
  errorMessage = '';

  constructor ( private purchaseFlowService: DocsPurchaseFlowService ) { }

  async ngOnInit (): Promise<void> {
    const sessionId = ( this.route.snapshot.queryParamMap.get( 'session_id' ) || '' ).trim();

    if ( !sessionId ) {
      this.isConfirming = false;
      this.errorMessage = 'Missing session information. Please try again.';
      return;
    }

    try {
      await this.purchaseFlowService.confirmCheckout( this.purchaseFlowConfig, sessionId );
      this.isSuccess = true;
    } catch ( err: any ) {
      this.errorMessage = err?.message || 'Something went wrong confirming your purchase.';
    } finally {
      this.isConfirming = false;
    }
  }

  goToDocs (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }
}
