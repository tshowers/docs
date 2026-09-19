import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';

export interface DocsAssistantPageContext {
  feature: string;
  page: string;
  route?: string;
  mode?: string;
  title?: string;
  description?: string;
  allowedActions?: string[];
  selectedEntityType?: string;
  selectedEntityId?: string;
  summary?: Record<string, any>;
  dataPreview?: Record<string, any>;
}

export interface DocsAssistantActivityEvent {
  feature: string;
  page: string;
  action: string;
  route?: string;
  mode?: string;
  summary?: Record<string, any>;
  meta?: Record<string, any>;
}

export interface DocsAssistantTranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Real implementation of the bus every ported Docs page already calls
 * into (document-home/document-editor/repository/response-flow) - same
 * pattern as Network's/Pulse's/Moves' signal services. This one's stub
 * predecessor was the plain 6-method shape (no signalState$/
 * engagementActionRequest$ to preserve, unlike Pulse's and Moves' wider
 * stubs).
 */
@Injectable( { providedIn: 'root' } )
export class DocsAssistantSignalService {
  private readonly pageContextSubject = new BehaviorSubject<DocsAssistantPageContext | null>( null );
  private readonly transcriptInSubject = new Subject<DocsAssistantTranscriptMessage>();
  private readonly activitySubject = new Subject<DocsAssistantActivityEvent>();
  private readonly unreadSubject = new BehaviorSubject<boolean>( false );
  private readonly readySubject = new BehaviorSubject<boolean>( false );

  readonly pageContext$ = this.pageContextSubject.asObservable();
  readonly transcriptIn$ = this.transcriptInSubject.asObservable();
  readonly activity$ = this.activitySubject.asObservable();
  readonly unread$ = this.unreadSubject.asObservable();
  readonly ready$ = this.readySubject.asObservable();

  get currentPageContext (): DocsAssistantPageContext | null {
    return this.pageContextSubject.value;
  }

  emitAssistantActivity ( event: DocsAssistantActivityEvent ): void {
    this.activitySubject.next( event );
  }

  setPageContext ( context: DocsAssistantPageContext ): void {
    this.pageContextSubject.next( context );
  }

  clearPageContext (): void {
    this.pageContextSubject.next( null );
  }

  pushTranscript ( message: DocsAssistantTranscriptMessage ): void {
    this.transcriptInSubject.next( message );
  }

  markAssistantUnread (): void {
    this.unreadSubject.next( true );
  }

  clearAssistantUnread (): void {
    this.unreadSubject.next( false );
  }

  setSignalReady (): void {
    this.readySubject.next( true );
  }
}
