/**
 * A Docs opportunity as /api/docs/opportunities returns it (todd-backend
 * docs/opportunities/opportunities.service.js toOpportunity): an RFP found
 * in a watched inbox or added by hand, with TODD's fit score.
 */
export type OpportunityStatus = 'new' | 'drafting' | 'submitted' | 'won' | 'lost' | 'dismissed';

/**
 * The lifecycle stage (design_handoff_todd_docs_lifecycle status model). The
 * API derives it from the stored status: new is found until TODD checks the
 * must-haves, then qualifying; drafting is in review while approval is open;
 * dismissed is no bid.
 */
export type OpportunityStage = 'found' | 'qualifying' | 'drafting' | 'in_review' | 'submitted' | 'won' | 'lost' | 'cancelled' | 'no_bid';

/** One pass/fail requirement from the RFP (lifecycle A, the Bid / No-Bid gate). */
export interface MustHave {
  id: string;
  ref: string;
  text: string;
  category: string;
  state: 'met' | 'not_met' | 'unknown';
  /** Where TODD found it, what's there instead, or what it looked for. */
  proof: string;
  /** The yes/no question for a not-sure one. */
  question: string;
  answer: '' | 'yes' | 'no' | 'unsure';
  answeredAt: string;
  knowledgeId: string;
}

export interface MustHaves {
  /** no_rfp: only the alert; unchecked: the RFP is there but not read yet. */
  status: 'no_rfp' | 'unchecked' | 'checking' | 'done' | 'failed';
  items: MustHave[];
  checkedAt: string;
  summary: { total: number; met: number; notMet: number; unknown: number };
}

export interface OpportunityDecision {
  type: 'draft' | 'draft_anyway' | 'no_bid' | string;
  at: string;
  userId: string;
  reason: string;
  detail: string;
}

export type KeyDateKind = 'questions_due' | 'prebid' | 'site_visit' | 'addendum' | 'expected_award' | 'other';

/** A date from the RFP, an addendum, or one the owner added. The proposal's own due date is `dueDate`. */
export interface KeyDate {
  id: string;
  kind: KeyDateKind;
  label: string;
  /** ISO: YYYY-MM-DD, or with a time and the RFP's offset. */
  date: string;
  where: string;
  source: 'rfp' | 'addendum' | 'you';
  /** When an addendum moved it. */
  previousDate: string;
}

export interface KeyDates {
  status: 'unchecked' | 'checking' | 'done' | 'failed' | 'no_rfp';
  items: KeyDate[];
  questionsTo: string;
  questionsVia: 'email' | 'portal' | 'unknown';
  checkedAt: string;
}

export interface BuyerQuestion {
  id: string;
  text: string;
  /** "unclear scope", "finds the incumbent"... */
  why: string;
  ref: string;
  picked: boolean;
}

export interface BuyerQuestions {
  items: BuyerQuestion[];
  /** to is "portal" when they were copied for the portal. */
  sent: { at: string; to: string; from: string; count: number; messageId: string } | null;
}

/** An addendum or the buyer's answers, from the watched inbox (lifecycle 1g). */
export interface BuyerUpdate {
  id: string;
  kind: 'addendum' | 'answers';
  number: string;
  headline: string;
  from: string;
  subject: string;
  receivedAt: string;
  changes: { kind: 'due_date' | 'date' | 'requirement' | 'form' | 'other'; title: string; detail: string; ref: string; newDate: string; checkAgain: boolean }[];
  answers: { question: string; answer: string; useful: boolean }[];
  savedAnswers: number;
  detailsElsewhere: boolean;
  link: string;
  read: boolean;
}

export interface Clarification {
  id: string;
  question: string;
  askedAt: string;
  /** Pasted by the owner, or caught in the watched inbox. */
  source: 'you' | 'inbox';
  answer: string;
  draftedAt: string;
  sentAt: string;
  sentTo: string;
  sentFrom: string;
}

export interface PostSubmittal {
  clarifications: Clarification[];
  orals: { date: string; attendees: string[]; place: string; minutes: number; prep: { questions: string[]; themes: string[]; numbers: string[]; at: string } | null } | null;
  outcome: { result: 'won' | 'lost' | 'cancelled'; reason: string; at: string } | null;
  debrief: { to: string; subject: string; sentAt: string; sentFrom: string; remindAt: string; repliedAt: string } | null;
  savedSections: string[];
}

export const LOSS_REASONS = ['Price', 'Experience', 'Technical', 'Incumbent', 'Unknown'] as const;

/** "Not for us": one tap, and Other with a note. */
export const NO_BID_REASONS = ['Missing must-have', 'Too big', 'Bad timing', 'Not our work', 'Other'] as const;
export type NoBidReason = typeof NO_BID_REASONS[number];

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
  /** Optional until every API that serves Docs sends them; read through stageOf / mustHavesOf. */
  stage?: OpportunityStage;
  mustHaves?: MustHaves;
  decision?: OpportunityDecision | null;
  noBid?: { reason: string; detail: string; at: string } | null;
  history?: OpportunityDecision[];
  /** Lifecycle C: key dates, TODD's questions for the buyer, unread addenda, the due date before an addendum moved it. */
  keyDates?: KeyDates;
  buyerQuestions?: BuyerQuestions;
  unreadUpdates?: number;
  dueDateBefore?: string;
  /** Lifecycle E: clarifications, orals, the award and the debrief (models/after-submittal). */
  post?: PostSubmittal;
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

export function stageOf ( opportunity: Pick<Opportunity, 'status' | 'stage'> ): OpportunityStage {
  if ( opportunity.stage ) return opportunity.stage;
  switch ( opportunity.status ) {
    case 'new': return 'found';
    case 'dismissed': return 'no_bid';
    default: return opportunity.status;
  }
}

export function mustHavesOf ( opportunity: Pick<Opportunity, 'mustHaves' | 'rfpDocumentId'> ): MustHaves {
  return opportunity.mustHaves || { status: opportunity.rfpDocumentId ? 'unchecked' : 'no_rfp', items: [], checkedAt: '', summary: { total: 0, met: 0, notMet: 0, unknown: 0 } };
}

/** Card tags (1h): Qualifying blue, Drafting violet, In review cyan, Submitted green, Found neutral. */
export const STAGE_LABEL: Record<OpportunityStage, { label: string; tint: string }> = {
  found: { label: 'Found', tint: 'neutral' },
  qualifying: { label: 'Qualifying', tint: 'blue' },
  drafting: { label: 'Drafting', tint: 'violet' },
  in_review: { label: 'In review', tint: 'cyan' },
  submitted: { label: 'Submitted', tint: 'green' },
  won: { label: 'Won', tint: 'green' },
  lost: { label: 'Lost', tint: 'pink' },
  cancelled: { label: 'Cancelled', tint: 'grey' },
  no_bid: { label: 'No-bid', tint: 'grey' },
};

/** The status line on opportunity detail (1a): the last step is the outcome. */
export const STAGE_STEPS: { key: string; label: string; stages: OpportunityStage[] }[] = [
  { key: 'found', label: 'Found', stages: ['found'] },
  { key: 'qualifying', label: 'Qualifying', stages: ['qualifying'] },
  { key: 'drafting', label: 'Drafting', stages: ['drafting'] },
  { key: 'in_review', label: 'In review', stages: ['in_review'] },
  { key: 'submitted', label: 'Submitted', stages: ['submitted'] },
  { key: 'outcome', label: 'Won / Lost / No-bid', stages: ['won', 'lost', 'cancelled', 'no_bid'] },
];

/** The cards' must-haves line (1h), or null when there's nothing to say. */
export function mustHavesLine ( opportunity: Opportunity ): { text: string; state: 'met' | 'not_met' | 'unknown' | 'waiting' } | null {
  const m = mustHavesOf( opportunity );
  if ( m.status === 'checking' ) return { text: 'Checking must-haves…', state: 'waiting' };
  if ( m.status !== 'done' || !m.summary.total ) return null;
  if ( m.summary.notMet ) return { text: `${ m.summary.notMet } ${ m.summary.notMet === 1 ? 'must-have' : 'must-haves' } missing`, state: 'not_met' };
  if ( m.summary.unknown ) return { text: `${ m.summary.unknown } ${ m.summary.unknown === 1 ? 'must-have' : 'must-haves' } to confirm`, state: 'unknown' };
  return { text: 'All must-haves met', state: 'met' };
}

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
  /** Added by an addendum. */
  checkAgain?: boolean;
}

/** One shall/must/will from the RFP (lifecycle B, the compliance matrix). */
export interface Requirement {
  id: string;
  ref: string;
  text: string;
  /** The RFP's own sentence, and its page (0 when unknown). */
  quote: string;
  page: number;
  type: 'shall' | 'must' | 'will';
  /** The proposal section that should answer it. */
  sectionKey: string;
  status: 'answered' | 'not_answered';
  answeredIn: { sectionKey: string; blockIndex: number; label: string } | null;
  /** The owner marked it themselves; TODD's matching leaves it alone. */
  manual: boolean;
  matchedAt: string;
  /** TODD's paragraph from Write this, waiting to be accepted or discarded. */
  suggestion: { sectionKey: string; text: string; at: string } | null;
  /** An addendum changed it, so it's back to not answered until it's matched again. */
  checkAgain?: boolean;
}

export interface Requirements {
  status: 'unchecked' | 'checking' | 'done' | 'failed' | 'no_rfp';
  items: Requirement[];
  summary: { total: number; answered: number; notAnswered: number };
  /** The RFP asks for the matrix with the proposal. */
  matrixRequired: boolean;
  extractedAt: string;
  matchedAt: string;
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
