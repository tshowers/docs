import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocsPurchaseFlowService } from '../../services/docs-purchase-flow.service';
import { KNOWLEDGE_PURCHASE_FLOW } from '../../services/purchase-flow.config';
import { PreloaderComponent } from '../../shared/preloader/preloader.component';
import { ClickSoundDirective } from '../../shared/directives/click-sound.directive';

/**
 * Ported from features/knowledge/knowledge-paid-success/knowledge-paid-success.component.ts,
 * trimmed the same way as DocsPaidSuccessComponent: ToddAssistantBusService's
 * signal-state subscription is dropped (this app doesn't carry TODD's
 * assistant bus), along with the lifecycle hooks that existed only to
 * drive it.
 */
@Component( {
  selector: 'app-knowledge-paid-success',
  standalone: true,
  imports: [CommonModule, RouterLink, PreloaderComponent, ClickSoundDirective],
  templateUrl: './knowledge-paid-success.component.html',
  styleUrl: './knowledge-paid-success.component.css'
} )
export class KnowledgePaidSuccessComponent implements OnInit {
  private readonly purchaseFlowConfig = KNOWLEDGE_PURCHASE_FLOW;
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

  goToKnowledge (): void {
    void this.router.navigate( [this.purchaseFlowConfig.postConfirmRoute] );
  }
}
