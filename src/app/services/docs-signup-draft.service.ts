import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { getAuth } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface StarterQuestion {
  key: string;
  label: string;
  question: string;
  category: string;
  answer: string;
}

/** Same starters as docs-ios's StarterQuestion - one is preselected, each
 * with a ready-to-edit answer instead of a blank box. "Other" types its own. */
export const STARTER_QUESTIONS: StarterQuestion[] = [
  {
    key: 'pricing', label: 'What do you charge?', question: 'What do you charge?', category: 'Pricing',
    answer: 'Pricing depends on what you need. After a quick call I\'ll send a clear quote, with no surprises later.',
  },
  {
    key: 'timing', label: 'How long does it take?', question: 'How long does it take?', category: 'Process',
    answer: 'Most projects take a few weeks from kickoff to delivery. Once we\'ve talked through the details, I\'ll give you a firm timeline.',
  },
  {
    key: 'gettingStarted', label: 'How do I get started?', question: 'How do I get started?', category: 'Process',
    answer: 'Getting started is simple: book a quick call, we talk through what you need, and I send a proposal within a couple of days.',
  },
  {
    key: 'different', label: 'What makes you different?', question: 'What makes you different?', category: 'Product',
    answer: 'Clients choose us because we\'re responsive, we explain things plainly, and we stand behind our work.',
  },
  { key: 'other', label: 'Other', question: '', category: 'General', answer: '' },
];

export interface DocsSignupDraft {
  starterKey: string;
  question: string;
  answer: string;
  firstName: string;
  lastName: string;
  companyName: string;
  /** Get started 3f: saved to Profile with the company name (blank fields only). */
  role?: string;
  companyDescription?: string;
  /** Set once the visitor reached the sign-in step; an abandoned draft is never submitted. */
  readyToSubmit: boolean;
}

const STOP_WORDS = new Set( ['what', 'do', 'you', 'your', 'how', 'does', 'it', 'the', 'a', 'an', 'is', 'are',
  'i', 'to', 'of', 'and', 'or', 'for', 'we', 'can', 'with', 'long', 'take', 'makes'] );

/**
 * The pre-sign-in /get-started wizard's draft - the web twin of docs-ios's
 * FirstAnswerDraft: a first Q&A answer (a Knowledge Base response flow),
 * then name and company. Kept in localStorage because sign-in leaves the
 * site for todd.taliferro.tech and comes back to /auth/callback. After
 * sign-in, submitIfPending() saves name, company, role and description to the TODD profile
 * (POST /api/onboarding/profile, blank fields only) and creates the answer
 * (POST /api/mobile/docs/knowledge-base - ID-token auth, works for web too).
 */
@Injectable( { providedIn: 'root' } )
export class DocsSignupDraftService {
  private readonly storageKey = 'docs_signup_draft';

  constructor ( private readonly http: HttpClient ) { }

  load (): DocsSignupDraft {
    const fresh = this.fromStarter( STARTER_QUESTIONS[0] );
    try {
      const raw = localStorage.getItem( this.storageKey );
      return raw ? { ...fresh, ...JSON.parse( raw ) } : fresh;
    } catch {
      return fresh;
    }
  }

  fromStarter ( starter: StarterQuestion, existing?: DocsSignupDraft ): DocsSignupDraft {
    return {
      starterKey: starter.key,
      question: starter.question,
      answer: starter.answer,
      firstName: existing?.firstName || '',
      lastName: existing?.lastName || '',
      companyName: existing?.companyName || '',
      role: existing?.role || '',
      companyDescription: existing?.companyDescription || '',
      readyToSubmit: false,
    };
  }

  starterFor ( draft: DocsSignupDraft ): StarterQuestion {
    return STARTER_QUESTIONS.find( ( starter ) => starter.key === draft.starterKey ) || STARTER_QUESTIONS[STARTER_QUESTIONS.length - 1];
  }

  /** Search keywords from the question's meaningful words, so TODD and Maya
   * can find the answer later without the user typing tags. */
  keywords ( draft: DocsSignupDraft ): string[] {
    const words = draft.question.toLowerCase().split( /[^a-z0-9]+/ ).filter( ( word ) => word.length > 2 && !STOP_WORDS.has( word ) );
    return [...new Set( [...words, this.starterFor( draft ).category.toLowerCase()] )];
  }

  save ( draft: DocsSignupDraft ): void {
    try { localStorage.setItem( this.storageKey, JSON.stringify( draft ) ); } catch { }
  }

  clear (): void {
    try { localStorage.removeItem( this.storageKey ); } catch { }
  }

  /** Never throws. Returns true when the answer was saved (the draft is then
   * cleared); on failure it's kept for the next sign-in. */
  async submitIfPending (): Promise<boolean> {
    const draft = this.load();
    const user = getAuth().currentUser;
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if ( !draft.readyToSubmit || !user || !question || !answer ) return false;

    try {
      const headers = { Authorization: `Bearer ${await user.getIdToken()}` };
      await firstValueFrom( this.http.post( `${environment.backendURL}/onboarding/profile`, {
        source: 'docs-web',
        profile: {
          firstName: draft.firstName,
          lastName: draft.lastName,
          companyName: draft.companyName,
          profession: draft.role || '',
          companyDescription: draft.companyDescription || '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
        },
      }, { headers } ) ).catch( () => undefined );

      await firstValueFrom( this.http.post( `${environment.backendURL}/mobile/docs/knowledge-base`, {
        title: question,
        question,
        response: answer,
        answers: [{ answer, source: '' }],
        category: this.starterFor( draft ).category,
        keywords: this.keywords( draft ),
      }, { headers } ) );
      this.clear();
      return true;
    } catch ( error ) {
      console.warn( '[DocsSignupDraftService] saving the sign-up answer failed; will retry next sign-in', error );
      return false;
    }
  }
}
