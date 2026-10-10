import { Document } from './document.model';

/**
 * The Documents filters and type plates (design_handoff_todd_docs 1h).
 *
 * The docs API has no folder or category yet, so the kind is read from the
 * record's type and, for contracts, pricing and compliance files, from words
 * in its title/topic/name. When upload starts filing documents into folders
 * this should prefer that folder.
 */
export type DocumentKind = 'rfp' | 'proposal' | 'contract' | 'pricing' | 'compliance' | 'media' | 'draft' | 'document';

export type DocumentTint = 'violet' | 'blue' | 'cyan' | 'green' | 'yellow' | 'pink' | 'grey';

export type DocumentSurface = 'image' | 'video' | 'pdf' | 'file';

export interface DocumentKindInfo {
  kind: DocumentKind;
  /** Singular label on a plate: "Proposal". */
  label: string;
  /** Filter pill / folder label: "Proposals". */
  plural: string;
  tint: DocumentTint;
}

export const DOCUMENT_KINDS: DocumentKindInfo[] = [
  { kind: 'rfp', label: 'RFP', plural: 'RFPs', tint: 'violet' },
  { kind: 'proposal', label: 'Proposal', plural: 'Proposals', tint: 'blue' },
  { kind: 'contract', label: 'Contract', plural: 'Contracts', tint: 'cyan' },
  { kind: 'pricing', label: 'Pricing', plural: 'Pricing', tint: 'green' },
  { kind: 'compliance', label: 'Compliance', plural: 'Compliance', tint: 'yellow' },
  { kind: 'media', label: 'Media', plural: 'Media', tint: 'pink' },
  { kind: 'draft', label: 'Draft', plural: 'Drafts', tint: 'blue' },
  { kind: 'document', label: 'Document', plural: 'Other', tint: 'grey' },
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|heic)$/;
const VIDEO_EXT = /\.(mp4|mov|webm|m4v)$/;
const AUDIO_EXT = /\.(mp3|wav|m4a|aac)$/;

function text ( value: unknown ): string {
  return String( value ?? '' ).trim().toLowerCase();
}

function pathOf ( doc: Partial<Document> | null | undefined ): string {
  return text( doc?.name || doc?.storagePath || doc?.src ).split( /[?#]/ )[0];
}

export function isEmbeddedVideoUrl ( url: string | null | undefined ): boolean {
  return /youtube\.com|youtu\.be|vimeo\.com|tiktok\.com/.test( text( url ) );
}

/** How a document previews: a picture, a player, a PDF page, or a type plate. */
export function documentSurface ( doc: Partial<Document> | null | undefined ): DocumentSurface {
  if ( !doc ) return 'file';
  const type = text( doc.type );
  const mime = text( doc.mimeType );
  const path = pathOf( doc );
  const src = text( doc.src );
  if ( type === 'image' || mime.startsWith( 'image/' ) || IMAGE_EXT.test( path ) ) return 'image';
  if ( type === 'video' || mime.startsWith( 'video/' ) || VIDEO_EXT.test( path ) || isEmbeddedVideoUrl( src ) ) return 'video';
  if ( mime.includes( 'pdf' ) || path.endsWith( '.pdf' ) ) return 'pdf';
  return 'file';
}

/** The big extension on a type plate: PDF, DOCX, XLSX... */
export function documentExtension ( doc: Partial<Document> | null | undefined ): string {
  const match = pathOf( doc ).match( /\.([a-z0-9]{2,5})$/ );
  if ( match ) return match[1].toUpperCase();
  const mime = text( doc?.mimeType );
  if ( mime.includes( 'pdf' ) ) return 'PDF';
  if ( mime.includes( 'wordprocessingml' ) || mime.includes( 'msword' ) ) return 'DOCX';
  if ( mime.includes( 'spreadsheetml' ) || mime.includes( 'excel' ) ) return 'XLSX';
  if ( mime.includes( 'presentationml' ) || mime.includes( 'powerpoint' ) ) return 'PPTX';
  if ( text( doc?.type ) === 'draft' || doc?.recordKind === 'draft' || doc?.htmlContent ) return 'DOC';
  return 'FILE';
}

export function documentKind ( doc: Partial<Document> | null | undefined ): DocumentKind {
  if ( !doc ) return 'document';
  const type = text( doc.type );
  if ( type === 'rfp' ) return 'rfp';
  if ( type === 'proposal' ) return 'proposal';
  const surface = documentSurface( doc );
  if ( surface === 'image' || surface === 'video' || AUDIO_EXT.test( pathOf( doc ) ) ) return 'media';
  const words = [doc.title, doc.topic, doc.name].map( text ).join( ' ' );
  if ( /\b(rfp|rfq|request for (proposals?|qualifications|quotes?))\b/.test( words ) ) return 'rfp';
  if ( /\bproposal\b/.test( words ) ) return 'proposal';
  if ( /\b(contract|agreement|msa|sow|statement of work|nda)\b/.test( words ) ) return 'contract';
  if ( /\b(pricing|price|rates?|quote|budget|cost)\b/.test( words ) ) return 'pricing';
  if ( /\b(insurance|certificate|coi|w-?9|license|compliance|certification|wmbe|dbe)\b/.test( words ) ) return 'compliance';
  if ( type === 'draft' ) return 'draft';
  return 'document';
}

export function documentKindInfo ( doc: Partial<Document> | null | undefined ): DocumentKindInfo {
  const kind = documentKind( doc );
  return DOCUMENT_KINDS.find( ( info ) => info.kind === kind ) || DOCUMENT_KINDS[DOCUMENT_KINDS.length - 1];
}

/** Drafts, documents and proposals open in the editor; everything else opens its file. */
export function opensInEditor ( doc: Partial<Document> | null | undefined ): boolean {
  return !!doc?.id && ['draft', 'document', 'proposal'].includes( text( doc.type ) ) && documentSurface( doc ) === 'file';
}

export function documentTitle ( doc: Partial<Document> | null | undefined ): string {
  return String( doc?.title || doc?.name || 'Untitled document' );
}

export function documentDate ( doc: Partial<Document> | null | undefined ): Date | null {
  const raw = doc?.updatedAt || doc?.uploadDate || doc?.createdAt;
  if ( !raw ) return null;
  const date = new Date( raw );
  return isNaN( date.getTime() ) ? null : date;
}

/** "Today", "Oct 9", or "Jun 2024" when it isn't this year. */
export function shortDocumentDate ( doc: Partial<Document> | null | undefined, now = new Date() ): string {
  const date = documentDate( doc );
  if ( !date ) return '';
  if ( date.toDateString() === now.toDateString() ) return 'Today';
  return date.getFullYear() === now.getFullYear()
    ? date.toLocaleDateString( 'en-US', { month: 'short', day: 'numeric' } )
    : date.toLocaleDateString( 'en-US', { month: 'short', year: 'numeric' } );
}

export function documentMatches ( doc: Partial<Document>, term: string ): boolean {
  const query = text( term );
  if ( !query ) return true;
  const haystack = [doc.title, doc.name, doc.topic, doc.type, doc.author, doc.summary, doc.description, documentKindInfo( doc ).label]
    .map( text ).join( ' ' );
  return haystack.includes( query );
}

export function formatBytes ( bytes: number | null | undefined ): string {
  if ( !bytes || bytes <= 0 ) return '';
  if ( bytes < 1024 * 1024 ) return `${ Math.max( 1, Math.round( bytes / 1024 ) ) } KB`;
  return `${ ( bytes / ( 1024 * 1024 ) ).toFixed( 1 ) } MB`;
}
