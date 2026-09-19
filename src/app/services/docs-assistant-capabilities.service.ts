import { Injectable } from '@angular/core';

export type LocalCapability = {
  id: string;
  label: string;
  hint?: string;
  patterns: string[];
  guard?: () => boolean;
};

export type DirectNavResult =
  | { handled: false; }
  | { handled: true; kind: 'message'; message: string; }
  | { handled: true; kind: 'navigate'; path: string; };

type WorkflowGuide = {
  id: string;
  patterns: RegExp[];
  message: string;
};

type RouteIntentGuide = {
  id: string;
  route: string;
  phrases: string[];
  message: string;
};

export type CapabilityContext = {
  placeholderChoices: string[];
};

/**
 * Docs' own slice of TODD's AssistantCapabilitiesService - same scoping
 * decision as web-products/network, web-products/pulse, and
 * web-products/moves' capabilities services. Unlike those three, Docs
 * carries genuinely rich route-intent phrase banks (document-home-
 * operations, document-list-operations, response-flow-operations,
 * knowledge-base-operations) - these were already Docs' own content in
 * TODD's original (not shared/suite-wide), so they're ported close to
 * verbatim, only remapping route paths from TODD's own (`/docs/app`,
 * `/documents`, `/document-editor`, `/response-flow`, `/knowledge-base`)
 * to this app's own routes (`/docs`, `/docs/documents`, `/docs/editor`,
 * `/knowledge/response-flow`, `/knowledge`). TODD's `maya-session-
 * operations` guide is Outreach/Maya content, not Docs, and is dropped
 * entirely, not adapted.
 */
@Injectable( { providedIn: 'root' } )
export class DocsAssistantCapabilitiesService {
  private readonly directRouteAliases: Record<string, string> = {
    'docs': 'docs',
    'docs home': 'docs',
    'knowledge cockpit': 'docs',
    'documents': 'docs/documents',
    'my documents': 'docs/documents',
    'document library': 'docs/documents',
    'document vault': 'docs/documents',
    'upload document': 'docs/upload',
    'upload a document': 'docs/upload',
    'document editor': 'docs/editor',
    'create document': 'docs/editor',
    'write a document': 'docs/editor',
    'proposal history': 'docs/proposal-history',
    'rfp list': 'docs/rfp-list',
    'my rfps': 'docs/rfp-list',
    'upload rfp': 'docs/rfp-upload',
    'add rfp': 'docs/rfp-upload',
    'knowledge base': 'knowledge',
    'knowledge': 'knowledge',
    'response flow': 'knowledge/response-flow',
    'add knowledge': 'knowledge/response-flow',
    'create knowledge entry': 'knowledge/response-flow',
    'pricing': 'docs/pricing',
    'home': '',
  };

  private readonly directCommandRoutes: { path: string; requiresId?: boolean; idParam?: string; }[] = [
    { path: '' },
    { path: 'docs' },
    { path: 'login' },
    { path: 'docs/pricing' },
    { path: 'docs/documents' },
    { path: 'docs/editor' },
    { path: 'docs/editor/:id', requiresId: true, idParam: 'id' },
    { path: 'docs/upload' },
    { path: 'docs/proposal-history' },
    { path: 'docs/rfp-list' },
    { path: 'docs/rfp-upload' },
    { path: 'knowledge' },
    { path: 'knowledge/response-flow' },
    { path: 'knowledge/response-flow/:id', requiresId: true, idParam: 'id' },
  ];

  private readonly workflowGuides: WorkflowGuide[] = [
    {
      id: 'create-doc',
      patterns: [
        /\bhow do i create (a )?(document|doc|proposal)\b/i,
        /\bhow to create (a )?(document|doc|proposal)\b/i,
        /\bhow do i upload (a )?document\b/i,
      ],
      message: [
        '<p><strong>Docs has a few different entry points.</strong></p>',
        '<p><strong>A.</strong> Start in the Knowledge cockpit at <strong>/docs</strong> if you want the full command deck.</p>',
        '<p><strong>B.</strong> Use <strong>/docs/editor</strong> to draft or edit a document directly.</p>',
        '<p><strong>C.</strong> Use <strong>/docs/upload</strong> to upload a file for TODD to work from.</p>',
        '<p><strong>D.</strong> Use <strong>/docs/rfp-upload</strong> if the goal is to turn an RFP into a proposal.</p>'
      ].join( '' )
    },
  ];

  private readonly routeIntentGuides: RouteIntentGuide[] = [
    {
      id: 'document-home-operations',
      route: '/docs',
      phrases: [
        'open knowledge',
        'open the knowledge dashboard',
        'show my knowledge dashboard',
        'take me to docs',
        'open docs',
        'show document health',
        'show knowledge health',
        'open the document cockpit',
        'show the knowledge cockpit',
        'take me to business knowledge',
        'show my business memory',
        'open document home',
        'give me a knowledge overview',
        'summarize my documents',
        'summarize my knowledge base',
        'what knowledge do we have',
        'show the big picture for documents',
        'how is our business knowledge doing',
        'what is the state of our documents',
        'give me a document summary',
        'show knowledge metrics',
        'show document metrics',
        'how much knowledge is stored',
        'what is happening in docs',
        'how healthy is my knowledge base',
        'what is my knowledge health',
        'show my knowledge score',
        'is our business knowledge healthy',
        'diagnose my documents',
        'what is wrong with our knowledge',
        'where is our knowledge system weak',
        'how healthy are our documents',
        'is our knowledge organized',
        'how strong is our business memory',
        'how easy are my documents to find',
        'show findability health',
        'is our knowledge easy to find',
        'do we have a document findability problem',
        'how organized is the document library',
        'are documents getting lost',
        'can people find the right document',
        'what is hurting document findability',
        'show knowledge retrieval health',
        'how searchable is our knowledge',
        'do we have naming problems',
        'how fresh is our knowledge',
        'show knowledge freshness',
        'are any documents going stale',
        'how many stale documents do we have',
        'is our information out of date',
        'show aging documents',
        'how current are our documents',
        'how many proposals can we reuse',
        'show proposal reuse',
        'do we have reusable proposal content',
        'how many drafts do we have',
        'show draft pressure',
        'what drafts need attention',
        'show capture readiness',
        'how ready is our knowledge for reuse',
        'can todd use our saved knowledge',
        'how much reusable knowledge do we have',
        'show reusable assets',
        'what documents can todd reuse',
        'how many documents do i have',
        'show total document count',
        'how large is my document library',
        'show document inventory',
        'what knowledge problems do i have',
        'show knowledge symptoms',
        'what is wrong with our docs',
        'what is todd doing with my documents',
        'show knowledge treatment',
        'show todd activity in docs',
        'show knowledge relief',
        'is document health improving',
        'show proof of knowledge improvement',
        'show the knowledge care cycle',
        'show symptom treatment relief and proof',
        'open the knowledge diagnosis board',
        'preview the knowledge dashboard',
        'what can i see before signing in',
        'show knowledge preview',
        'why are the document values zero'
      ],
      message: [
        '<p><strong>This sounds like Docs cockpit work.</strong></p>',
        '<p>Open <strong>/docs</strong> for knowledge health, freshness, findability, proposal reuse, draft pressure, and TODD knowledge-treatment activity.</p>',
        '<p>Once you are there, the TODD popup has the live Docs page context and can help from that cockpit.</p>'
      ].join( '' )
    },
    {
      id: 'document-list-operations',
      route: '/docs/documents',
      phrases: [
        'open documents',
        'show my documents',
        'take me to documents',
        'open the document vault',
        'show my files',
        'browse my documents',
        'open saved files',
        'show the document library',
        'take me to the document repository',
        'show files todd knows about',
        'open my business files',
        'show stored documents',
        'show all documents',
        'browse all files',
        'show everything in the vault',
        'list my documents',
        'show all saved files',
        'browse the document library',
        'show every document',
        'show all uploaded files',
        'let me look through my documents',
        'show everything todd has stored',
        'open the full document list',
        'show my document collection',
        'search my documents',
        'find a document',
        'search the document vault',
        'look for a file',
        'find documents about pricing',
        'search files by title',
        'find documents by topic',
        'search by author',
        'find documents by type',
        'look through document summaries',
        'search stored files',
        'find something in my vault',
        'find the acme proposal',
        'show the security policy',
        'find the document named onboarding plan',
        'look for the microsoft presentation',
        'show the file called project scope',
        'find my business plan',
        'show documents about cybersecurity',
        'find files about pricing',
        'show documents related to onboarding',
        'find our ai policy documents',
        'show documents written by vikki',
        'find files authored by tyrone',
        'show documents from this author',
        'show pdfs',
        'find all images',
        'show videos',
        'find spreadsheets',
        'show presentations',
        'show stale documents',
        'show old documents',
        'find documents that need review',
        'find outdated documents',
        'show documents with duplicate titles',
        'find duplicate document names',
        'clear document search',
        'reset the document list',
        'remove document filters',
        'open this document',
        'view this file',
        'show the full document',
        'preview this document',
        'show this file without leaving the page',
        'open the lightbox',
        'play this video',
        'open the video',
        'watch this file',
        'edit this draft',
        'open this document in the editor',
        'continue writing this document',
        'update this proposal',
        'add a document',
        'upload a document',
        'store a new file',
        'add something to the vault',
        'upload a pdf',
        'save a new file',
        'open the document editor',
        'start writing a document',
        'create a draft',
        'write a new document',
        'compose a document',
        'delete this document',
        'remove this file',
        'remove this document from the vault',
        'add knowledge from these documents',
        'create a knowledge entry',
        'teach todd from a document',
        'turn a document into reusable knowledge',
        'open proposal history',
        'show past proposals',
        'browse old proposals',
        'upload an rfp',
        'add an rfp',
        'show my rfps',
        'open the rfp list',
        'help me with documents',
        'how do documents work',
        'show document help',
        'how do i use the document vault',
        'help me find a file',
        'what can i do with documents'
      ],
      message: [
        '<p><strong>This sounds like Documents workspace work.</strong></p>',
        '<p>Open <strong>/docs/documents</strong> to browse, search, preview, organize, upload, edit, or remove stored files, and to jump into related document actions like <strong>/knowledge/response-flow</strong>, <strong>/docs/editor</strong>, <strong>/docs/proposal-history</strong>, <strong>/docs/rfp-upload</strong>, or <strong>/docs/rfp-list</strong>.</p>',
        '<p>Once you are there, the TODD popup has the live Documents page context and can help with the current file or view.</p>'
      ].join( '' )
    },
    {
      id: 'response-flow-operations',
      route: '/knowledge/response-flow',
      phrases: [
        'add knowledge',
        'open knowledge entry',
        'create a knowledge entry',
        'capture some knowledge',
        'save something to the knowledge base',
        'add something to the knowledge base',
        'open the knowledge builder',
        'record business knowledge',
        'store an answer',
        'create a reusable answer',
        'teach todd something',
        'add information for todd to remember',
        'create a new knowledge entry',
        'save a new question and answer',
        'add a reusable answer',
        'record an answer to a common question',
        'create an answer todd can use later',
        'add a question to the knowledge base',
        'save this information for later',
        'turn this into reusable knowledge',
        'save this answer',
        'remember this answer',
        'keep this response for later',
        'store what todd just said',
        'turn this answer into a knowledge entry',
        'edit this knowledge entry',
        'update this answer',
        'change the saved response',
        'revise this knowledge',
        'correct this answer',
        'add a question',
        'write the question',
        'save this common question',
        'categorize this knowledge',
        'add a category',
        'classify this entry',
        'add the answer',
        'write a response',
        'save this response',
        'tell todd how to answer this',
        'add a sourced answer',
        'cite the source',
        'add evidence for this answer',
        'attach an existing document',
        'link this answer to a document',
        'attach a file from my document library',
        'upload a supporting document',
        'attach a file',
        'upload evidence',
        'attach a pdf',
        'add a recommendation',
        'recommend a practice',
        'add a policy recommendation',
        'add a resource',
        'attach a useful link',
        'save this reference',
        'add keywords',
        'tag this knowledge',
        'add search terms',
        'improve how this entry is found',
        'make this easier to find',
        'help todd reuse this answer',
        'prepare this answer for reuse',
        'preview the knowledge entry',
        'show me how the answer will look',
        'review the saved answer',
        'save this knowledge entry',
        'submit the answer',
        'publish this to the knowledge base',
        'exit knowledge entry',
        'go back to the knowledge base',
        'cancel this entry',
        'discard this entry'
      ],
      message: [
        '<p><strong>This sounds like Response Flow work.</strong></p>',
        '<p>Open <strong>/knowledge/response-flow</strong> to create or update reusable knowledge with questions, answers, sources, recommendations, resources, categories, and keywords.</p>',
        '<p>Once you are there, the TODD popup has the live Response Flow context and can help with the current step.</p>'
      ].join( '' )
    },
    {
      id: 'knowledge-base-operations',
      route: '/knowledge',
      phrases: [
        'open the knowledge base',
        'show the knowledge base',
        'take me to the knowledge base',
        'open saved knowledge',
        'show what todd knows',
        'browse business knowledge',
        'open the knowledge repository',
        'show saved answers',
        'show our reusable knowledge',
        'open business memory',
        'show stored questions and answers',
        'take me to saved knowledge',
        'show all knowledge entries',
        'browse saved answers',
        'show all questions and answers',
        'show everything todd knows',
        'browse the knowledge library',
        'show our knowledge items',
        'list saved responses',
        'show reusable answers',
        'show the full knowledge base',
        'let me browse our business knowledge',
        'show captured knowledge',
        'list all knowledge entries',
        'search the knowledge base',
        'find knowledge about pricing',
        'find our answer about refunds',
        'search saved answers',
        'look for information about onboarding',
        'find a question about security',
        'search our business knowledge',
        'look through saved responses',
        'find knowledge containing microsoft',
        'search questions and answers',
        'find anything about proposals',
        'look for saved guidance',
        'find the question about pricing',
        'show our refund question',
        'find the entry about security',
        'do we have a question about onboarding',
        'show the saved question about contracts',
        'find common questions about todd',
        'show questions about implementation',
        'do we already have this question saved',
        'find the answer that mentions 30 days',
        'show answers about implementation',
        'find our approved pricing answer',
        'search answers for microsoft',
        'find the response about data security',
        'show saved answers mentioning contracts',
        'find what we say about onboarding',
        'search response text',
        'find our standard response',
        'show knowledge in the pricing category',
        'filter knowledge by category',
        'show policy knowledge',
        'show entries in technology',
        'find answers categorized as security',
        'show sales knowledge',
        'filter the knowledge base to email',
        'show only onboarding entries',
        'find knowledge in the proposal category',
        'filter saved responses by category',
        'show all items under customer support',
        'clear the knowledge search',
        'reset the knowledge base',
        'show all knowledge again',
        'remove the search filter',
        'clear the category filter',
        'reset saved answers',
        'remove knowledge filters',
        'show every knowledge item',
        'open this knowledge entry',
        'show this answer',
        'open the saved question',
        'show the full knowledge item',
        'inspect this response',
        'open this question and answer',
        'show the supporting evidence',
        'view this knowledge record',
        'show everything saved for this question',
        'open the entry details',
        'show the evidence for this answer',
        'where did this answer come from',
        'show the sources',
        'show supporting documents',
        'what supports this response',
        'show citations for this answer',
        'open the evidence summary',
        'show the source links',
        'which documents support this answer',
        'show recommendations for this answer',
        'what do we recommend',
        'show the recommended practice',
        'show policy recommendations',
        'what should someone do next',
        'show best practices for this question',
        'show the recommendation section',
        'what actions are recommended',
        'show saved advice',
        'show resources for this answer',
        'show supporting links',
        'what resources are attached',
        'show further reading',
        'open the saved resources',
        'show useful links for this question',
        'show external references',
        'show the resource list',
        'show keywords for this entry',
        'what is this knowledge tagged with',
        'show search terms',
        'what keywords help todd find this',
        'show the saved tags',
        'show entry keywords',
        'how is this answer indexed',
        'show knowledge tags',
        'copy the citation',
        'copy this source',
        'give me a citation for this answer',
        'copy the evidence citation',
        'copy the reference',
        'edit this knowledge entry',
        'update this saved answer',
        'change this response',
        'revise this knowledge',
        'correct this answer',
        'change the category',
        'edit the sources',
        'add more recommendations',
        'update the keywords',
        'improve this saved knowledge',
        'delete this knowledge entry',
        'remove this answer',
        'delete the saved question',
        'remove this from the knowledge base',
        'get rid of this response',
        'delete this knowledge item',
        'take this out of todd',
        'show knowledge sourced from microsoft',
        'find answers using this website',
        'show entries with government sources',
        'find knowledge linked to this document',
        'find entries using this url',
        'show knowledge from this domain',
        'search knowledge by citation',
        'show knowledge bookmarked from find',
        'show saved find results',
        'find knowledge captured from search',
        'show bookmarked answers',
        'show saved search results',
        'show find bookmarks',
        'what does todd know',
        'what answers are already saved',
        'what knowledge have we captured',
        'what topics are in the knowledge base',
        'what questions can todd answer',
        'what business knowledge do we have',
        'what categories are represented',
        'what reusable responses exist',
        'what information is stored here',
        'what has been added to the knowledge base'
      ],
      message: [
        '<p><strong>This sounds like Knowledge Base work.</strong></p>',
        '<p>Open <strong>/knowledge</strong> to browse, search, inspect, organize, edit, remove, cite, or reuse knowledge already stored in TODD.</p>',
        '<p>If you need to create a brand new reusable answer, use <strong>/knowledge/response-flow</strong>. Once you are in the Knowledge Base, the TODD popup has the live repository context.</p>'
      ].join( '' )
    },
  ];

  private normalizeCommand ( text: string ): string {
    return ( text || '' )
      .toLowerCase()
      .replace( /[\/\-]/g, ' ' )
      .replace( /[^a-z0-9\s]/g, ' ' )
      .replace( /\s+/g, ' ' )
      .trim();
  }

  private stripLeadingVerb ( text: string ): string {
    const verbs = ['show', 'open', 'go', 'goto', 'navigate', 'add', 'upload', 'take', 'create'];
    const fillers = new Set( ['me', 'to', 'the', 'a', 'an', 'page'] );
    const parts = ( text || '' ).trim().toLowerCase().split( /\s+/ );
    if ( !parts.length ) return '';

    let idx = 0;
    if ( verbs.includes( parts[0] ) ) {
      idx = 1;
      while ( idx < parts.length && fillers.has( parts[idx] ) ) idx++;
    }
    return parts.slice( idx ).join( ' ' );
  }

  public tryDirectNavCommand ( prompt: string ): DirectNavResult {
    const raw = ( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const withoutVerb = this.stripLeadingVerb( raw );
    if ( !withoutVerb ) return { handled: false };

    const normalizedInput = this.normalizeCommand( withoutVerb );
    const rawLower = raw.toLowerCase();
    const aliasedPath = this.directRouteAliases[normalizedInput];

    if ( aliasedPath !== undefined ) {
      return { handled: true, kind: 'navigate', path: '/' + aliasedPath };
    }

    for ( const route of this.directCommandRoutes ) {
      const normalizedRoute = this.normalizeCommand( route.path );

      if ( route.requiresId ) {
        if ( normalizedInput === normalizedRoute ) {
          const baseLabel = normalizedRoute;
          return {
            handled: true,
            kind: 'message',
            message: `To open a ${baseLabel}, type "${baseLabel} YOUR_ID" (for example: "${baseLabel} 12345").`
          };
        }

        if ( normalizedInput.startsWith( normalizedRoute + ' ' ) ) {
          const idPart = normalizedInput.slice( normalizedRoute.length + 1 ).trim();
          if ( !idPart ) continue;
          const navPath = route.path.replace( /:([^\/]+)/, idPart );
          return { handled: true, kind: 'navigate', path: '/' + navPath };
        }

        continue;
      }

      if ( normalizedInput === normalizedRoute || rawLower === route.path.toLowerCase() ) {
        return { handled: true, kind: 'navigate', path: '/' + route.path };
      }
    }

    return { handled: false };
  }

  public tryWorkflowGuide ( prompt: string ): DirectNavResult {
    const raw = String( prompt || '' ).trim();
    if ( !raw ) return { handled: false };

    const guide = this.workflowGuides.find( item => item.patterns.some( pattern => pattern.test( raw ) ) );
    if ( !guide ) return { handled: false };

    return { handled: true, kind: 'message', message: guide.message };
  }

  public tryRouteIntentGuide ( prompt: string ): DirectNavResult {
    const normalizedPrompt = this.normalizeCommand( prompt );
    if ( !normalizedPrompt ) return { handled: false };

    const guide = this.routeIntentGuides.find( item =>
      item.phrases.some( phrase => {
        const normalizedPhrase = this.normalizeCommand( phrase );
        return normalizedPrompt === normalizedPhrase || normalizedPrompt.includes( normalizedPhrase );
      } )
    );

    if ( !guide ) return { handled: false };

    return { handled: true, kind: 'message', message: guide.message };
  }

  private getNavCommandCapabilities (): LocalCapability[] {
    return this.directCommandRoutes
      .filter( c => !c.requiresId && c.path )
      .map( c => {
        const label = this.normalizeCommand( c.path );
        return {
          id: `nav-${c.path}`,
          label,
          hint: `Go to ${label}`,
          patterns: [label, c.path.toLowerCase()],
          guard: () => true
        };
      } );
  }

  public getLocalCapabilities ( ctx: CapabilityContext ): LocalCapability[] {
    const base: LocalCapability[] = [
      {
        id: 'write-document',
        label: 'Write a document',
        hint: 'One-pager, letter, brief, or summary',
        patterns: ['write document', 'draft document', 'create document', 'one-pager', 'letter', 'brief'],
        guard: () => true
      },
      {
        id: 'write-proposal',
        label: 'Create a proposal from an RFP',
        hint: 'Upload RFP text to generate a draft',
        patterns: ['proposal', 'generate proposal', 'rfp', 'request for proposal'],
        guard: () => true
      },
      {
        id: 'add-knowledge',
        label: 'Add a knowledge entry',
        hint: 'Save a reusable Q&A',
        patterns: ['add knowledge', 'create knowledge entry', 'save answer'],
        guard: () => true
      },
      {
        id: 'help',
        label: 'How this works',
        hint: 'Open Assistant Box help',
        patterns: ['help', 'how it works', 'what can you do'],
        guard: () => true
      }
    ];

    return [...base, ...this.getNavCommandCapabilities()];
  }

  public scoreLocalSuggestions ( query: string, ctx: CapabilityContext ): string[] {
    const caps = this.getLocalCapabilities( ctx );
    const q = ( query || '' ).trim().toLowerCase();
    if ( !q ) return [];

    const terms = q.split( /\s+/ );
    const termScore = ( text: string, weight = 1 ) => terms.reduce( ( s, t ) => ( text.includes( t ) ? s + weight : s ), 0 );

    const ranked = caps
      .map( c => {
        const label = c.label.toLowerCase();
        const hint = ( c.hint || '' ).toLowerCase();
        const patterns = c.patterns.join( ' ' ).toLowerCase();
        const score = termScore( label, 3 ) + termScore( patterns, 2 ) + termScore( hint, 1 );
        return { c, score };
      } )
      .filter( x => x.score > 0 )
      .sort( ( a, b ) => b.score - a.score )
      .map( x => x.c.label );

    if ( !ranked.length ) {
      return ( ctx.placeholderChoices || [] ).filter( p => p.toLowerCase().includes( q ) ).slice( 0, 8 );
    }

    return Array.from( new Set( ranked ) ).slice( 0, 8 );
  }
}
