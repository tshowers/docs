/**
 * A Docs opportunity as /api/docs/opportunities returns it (todd-backend
 * docs/opportunities/opportunities.service.js toOpportunity): an RFP found
 * in a watched inbox or added by hand, with TODD's fit score.
 */
export type OpportunityStatus = 'new' | 'drafting' | 'submitted' | 'won' | 'lost' | 'dismissed';

export interface Opportunity {
  id: string;
  title: string;
  agency: string;
  solicitationNumber: string;
  summary: string;
  /** ISO date or date-time, or '' when the alert didn't say. */
  dueDate: string;
  estimatedValue: string;
  pageLimit: string;
  portalUrl: string;
  submission: { method: 'email' | 'portal' | 'mail' | 'unknown'; email: string };
  criteria: { name: string; points: number }[];
  fit: { score: number; headline: string; reasons: string[]; gaps: string[] };
  source: { kind: 'email' | 'upload'; label: string; from: string; subject: string; receivedAt: string; mailboxId: string; documentId?: string };
  status: OpportunityStatus;
  rfpDocumentId: string;
  proposalDocumentId: string;
  /** What was sent (Review & send), or null. */
  submissionRecord?: { method: 'email' | 'portal'; to: string; from?: string; subject?: string; note?: string; submittedAt: string; attachments?: { filename: string; bytes: number }[] } | null;
  createdAt: string;
  updatedAt: string;
}

/** A connected inbox (redacted mailbox config) with what Docs needs from it. */
export interface DocsInbox {
  id: string;
  emailAddress: string;
  displayName: string;
  provider: string;
  providerLabel: string;
  status: string;
  purposes: ('outreach' | 'rfp')[];
  rfpSenders: string[];
  rfpLastSyncAt: string;
  rfpLastSyncStatus: string;
  rfpFoundCount: number;
}

/** Fit at or above this is "fits you" (design: 85+ green, 75-84 blue, below yellow). */
export const FIT_THRESHOLD = 75;

export function fitTint ( score: number ): 'green' | 'blue' | 'yellow' {
  if ( score >= 85 ) return 'green';
  if ( score >= FIT_THRESHOLD ) return 'blue';
  return 'yellow';
}

function parseDue ( value: string ): Date | null {
  if ( !value ) return null;
  // A bare date is the end of that local day, not midnight UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test( value ) ? new Date( `${ value }T23:59:00` ) : new Date( value );
  return isNaN( date.getTime() ) ? null : date;
}

export function dueDate ( opportunity: Pick<Opportunity, 'dueDate'> ): Date | null {
  return parseDue( opportunity.dueDate );
}

/** "Due Oct 24 · 14 days", "Due today", "Closed Oct 2", or '' when unknown. */
export function dueLabel ( opportunity: Pick<Opportunity, 'dueDate'>, now = new Date() ): string {
  const date = dueDate( opportunity );
  if ( !date ) return '';
  const day = date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } );
  const startOf = ( d: Date ) => new Date( d.getFullYear(), d.getMonth(), d.getDate() ).getTime();
  const days = Math.round( ( startOf( date ) - startOf( now ) ) / 86400000 );
  if ( days < 0 ) return `Closed ${ day }`;
  if ( days === 0 ) return 'Due today';
  return `Due ${ day } · ${ days } ${ days === 1 ? 'day' : 'days' }`;
}

/** Due date with the time when the RFP gives one: "Oct 24, 2 PM PT"-style. */
export function dueLong ( opportunity: Pick<Opportunity, 'dueDate'> ): string {
  const date = dueDate( opportunity );
  if ( !date ) return '';
  const hasTime = /T\d{2}:\d{2}/.test( opportunity.dueDate );
  return date.toLocaleString( 'en-US', hasTime ? { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' } : { month: 'short', day: 'numeric', year: 'numeric' } );
}

export function isOpen ( opportunity: Opportunity, now = new Date() ): boolean {
  const date = dueDate( opportunity );
  return !date || date.getTime() >= now.getTime();
}

export function submitByLabel ( opportunity: Pick<Opportunity, 'submission'> ): string {
  switch ( opportunity.submission.method ) {
    case 'email': return 'Email';
    case 'portal': return 'Portal';
    case 'mail': return 'Mail';
    default: return 'See the RFP';
  }
}

export const PROPOSAL_STATUS_LABEL: Record<OpportunityStatus, { label: string; tint: string }> = {
  new: { label: 'New', tint: 'blue' },
  drafting: { label: 'Draft', tint: 'yellow' },
  submitted: { label: 'Submitted', tint: 'blue' },
  won: { label: 'Won', tint: 'green' },
  lost: { label: 'Lost', tint: 'pink' },
  dismissed: { label: 'Not for us', tint: 'grey' },
};

/** The proposal editor's draft (todd-backend docs/proposals/proposalDraft.model.js). */
export interface ProposalBlock {
  type: 'heading' | 'paragraph' | 'knowledge' | 'waiting';
  text: string;
  knowledgeId?: string;
  knowledgeTitle?: string;
  questionId?: string;
}

export interface ProposalSection {
  key: string;
  title: string;
  ask: string;
  criteria: string[];
  status: 'pending' | 'drafting' | 'done' | 'waiting';
  blocks: ProposalBlock[];
  needsRedraft?: boolean;
}

export interface ProposalQuestion {
  id: string;
  sectionKey: string;
  question: string;
  why: string;
  status: 'open' | 'answered' | 'skipped';
  answer: string;
  knowledgeId: string;
}

export interface ProposalCheck {
  id: string;
  kind: string;
  label: string;
  detail: string;
  ok: boolean;
  status: string;
  documentId?: string;
}

export interface ProposalDraft {
  opportunityId: string;
  proposalDocumentId: string;
  hasRfpFile: boolean;
  sections: ProposalSection[];
  questions: ProposalQuestion[];
  checklist: ProposalCheck[];
  pages: number;
  updatedAt: string;
  /** The document was edited in the editor, so TODD no longer writes into it. */
  documentEdited?: boolean;
}
