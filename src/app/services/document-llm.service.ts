import { Injectable } from '@angular/core';
import { Subscription } from 'rxjs';

import { OpenAIService } from './open-ai.service';
import { AssistantBoxHelperService } from './assistant-box-helper.service';
import { LoggerService } from './logger.service';

export type AssistantMessage = { role: 'user' | 'assistant'; content: string; };
export type AssistantUiPatch = Partial<{
  assistantResponse: string;
  pendingAction: { action: string; param: any; } | null;
  inlineReply: any | null;
  showConfirmPrompt: boolean;
}>;

export type RunDocumentArgs = {
  promptWithContext: string;
  userId: string;
  history: AssistantMessage[];

  setLoading: ( v: boolean ) => void;
  patchState: ( patch: AssistantUiPatch ) => void;
  emitAssistant?: ( assistantHtml: string ) => void;
  onError: ( err: any ) => void;
};

/**
 * Port of TODD's DocumentLLMService, unchanged - it only ever depended on
 * OpenAIService/AssistantBoxHelperService/LoggerService, so it was already
 * scoped to just the Document domain.
 */
@Injectable( { providedIn: 'root' } )
export class DocumentLLMService {
  constructor (
    private openAIService: OpenAIService,
    private assistantBoxHelper: AssistantBoxHelperService,
    private logger: LoggerService
  ) { }

  run ( args: RunDocumentArgs ): Subscription {
    const {
      promptWithContext,
      userId,
      history,
      setLoading,
      patchState,
      emitAssistant,
      onError
    } = args;

    setLoading( true );
    patchState( { assistantResponse: '', pendingAction: null, inlineReply: null, showConfirmPrompt: false } );

    return this.openAIService.getDocumentAssistantResponse( promptWithContext, userId, { history } ).subscribe( {
      next: ( res: any ) => {
        setLoading( false );
        const content: any = res?.parsedQuery ?? res ?? {};

        if ( content.route && content.action !== 'createDocument' ) {
          const [path, fragment] = String( content.route ).split( '#' );
          const routeStr = fragment ? `${path}#${fragment}` : path;

          if ( content.param && typeof content.param === 'object' ) {
            const inlineReply = {
              kind: 'navigateWithFilters',
              payload: content.param,
              apply: { route: routeStr, param: content.param }
            };

            const html =
              this.assistantBoxHelper.normalizeAssistantHtml(
                this.assistantBoxHelper.convertMarkdownToHtml(
                  this.assistantBoxHelper.parseAssistantResponse( content )
                )
              ) || 'Open this view?';

            patchState( { inlineReply, assistantResponse: html, showConfirmPrompt: false, pendingAction: null } );
            return;
          }

          patchState( { pendingAction: { action: 'navigate', param: routeStr } } );
        }

        if ( content.action ) {
          if ( content.action === 'createDocument' ) {
            const { title, kind } = content.param || {};
            const html = this.assistantBoxHelper.convertMarkdownToHtml(
              `📝 Create document?\n\n**${title || 'Untitled'}**${kind ? `\n\nType: **${kind}**` : ''}`
            );
            patchState( {
              assistantResponse: html,
              pendingAction: { action: 'createDocument', param: content.param },
              showConfirmPrompt: true,
              inlineReply: null
            } );
            return;
          }

          const html =
            this.assistantBoxHelper.normalizeAssistantHtml(
              this.assistantBoxHelper.convertMarkdownToHtml(
                this.assistantBoxHelper.parseAssistantResponse( content )
              )
            ) || 'Proceed with this action?';

          patchState( {
            pendingAction: { action: content.action, param: content.param },
            assistantResponse: html,
            showConfirmPrompt: true,
            inlineReply: null
          } );
          return;
        }

        const message = this.assistantBoxHelper.parseAssistantResponse( content );
        if ( message ) {
          const html = this.assistantBoxHelper.normalizeAssistantHtml(
            this.assistantBoxHelper.convertMarkdownToHtml( message )
          );
          patchState( { assistantResponse: html } );
          if ( emitAssistant ) emitAssistant( html );
        }

        const shouldShowCta = !!( content.route && !content.param && content.action !== 'createDocument' );
        patchState( { showConfirmPrompt: shouldShowCta } );
      },
      error: ( err: any ) => {
        this.logger.error( 'DOCUMENT_LLM_ERROR', err );
        onError( err );
      }
    } );
  }
}
