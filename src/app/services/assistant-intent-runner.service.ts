import { Injectable } from '@angular/core';

/**
 * Trimmed port of TODD's AssistantIntentRunnerService. Unlike Network/
 * Pulse/Moves' ports, Docs keeps isKnowledgeTopicQuestion() - it's the one
 * pre-check that actually applies here, since Docs owns both the Document
 * and Knowledge domains. decideEarlyIntercept (Catalyst/composer/
 * email-sent) is still dropped - that's Outreach-only.
 */
@Injectable( { providedIn: 'root' } )
export class AssistantIntentRunnerService {
    /**
     * Distinguishes "what is X" / topic questions (-> Knowledge) from
     * direct create/draft commands (-> Document) or nav-style asks.
     */
    isKnowledgeTopicQuestion ( prompt: string ): boolean {
        const p = ( prompt || '' ).trim();
        if ( !p ) return false;

        if ( /\b(create|draft|write|make)\b\s+(a\s+)?(document|doc|one[-\s]?pager|proposal)\b/i.test( p ) ) {
            return false;
        }

        if ( /^\s*(what\s+is|define|explain|how\s+do\s+i|how\s+does|why\s+does|best\s+way\s+to|best\s+practices\s+for|steps\s+to)\b/i.test( p ) ) {
            return true;
        }

        if ( p.endsWith( '?' ) && !/(open|show|navigate|go\s+to|filter|find\s+documents|upload\s+document)\b/i.test( p ) ) {
            return true;
        }

        return false;
    }

    /** Only one non-knowledge domain exists here, so this only ever confirms it applies. */
    routeDomain ( prompt: string ): 'document' | null {
        const p = ( prompt || '' ).trim();
        if ( !p ) return null;
        const lower = p.toLowerCase();

        if ( /(doc|document|one[-\s]?pager|letter|proposal|rfp)/.test( lower ) ) return 'document';

        return null;
    }
}
