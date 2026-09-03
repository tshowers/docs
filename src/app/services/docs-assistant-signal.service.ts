import { Injectable } from '@angular/core';

/**
 * No-op stand-in for the page-context/activity-reporting slice of
 * ToddAssistantBusService. This app deliberately doesn't carry TODD's full
 * assistant bus, so ported components' calls to report page context,
 * transcript nudges, and activity events have nowhere to go. Kept as a
 * same-shaped no-op rather than deleted from each call site, both to
 * minimize the diff against the original component and because a real
 * Docs/Knowledge-scoped assistant (if/when built) would plug in here.
 * Ported from web-products/network's NetworkAssistantSignalService.
 */
@Injectable( { providedIn: 'root' } )
export class DocsAssistantSignalService {
  emitAssistantActivity ( _event: Record<string, unknown> ): void { }
  setPageContext ( _context: Record<string, unknown> ): void { }
  clearPageContext (): void { }
  pushTranscript ( _message: { role: string; content: string } ): void { }
  markAssistantUnread (): void { }
  setSignalReady (): void { }
}
