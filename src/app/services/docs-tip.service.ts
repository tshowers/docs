import { Injectable } from '@angular/core';

export type DocsTipCategory = 'documents';

export interface DocsTip {
  id: string;
  text: string;
  category: DocsTipCategory;
  page?: string;
}

/**
 * Trimmed from services/tip.service.ts (422 lines, tips for every TODD
 * module - projects, tasks, contacts, email, surveys, documents) - only
 * the 'documents' category entries are kept, since Docs/Knowledge are the
 * only modules this app's tip boxes appear in. Same `getRandomTipText`
 * shape as the original so ported components (general-document-upload,
 * response-flow) call it unchanged.
 */
@Injectable( {
  providedIn: 'root'
} )
export class DocsTipService {
  private readonly tips: DocsTip[] = [
    {
      id: 'kb-rf-1',
      text: 'Write questions the way users actually ask them. TODD searches better when the wording feels real, not formal.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-2',
      text: 'One question per entry. If you feel tempted to add “and” in the question, you probably need a second Response Flow.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-3',
      text: 'Keep answers short and direct. Use links and attached documents for deep detail instead of long walls of text.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-4',
      text: 'Always add a source for each answer. Cited responses build trust and make it easier to update later.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-5',
      text: 'Use Recommendations for “what to do next,” not more info. Think actions, policies, or practices someone should follow.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-6',
      text: 'Resources should point to the best version of a thing, not every version. Link to one strong doc, not five copies.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-7',
      text: 'Tag keywords by how people search, not how you talk internally. Use plain words that a new teammate would type.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-8',
      text: 'Repeat important keywords across similar entries. Consistent tagging makes the Knowledge Base feel “smart” instead of random.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-9',
      text: 'If a question keeps showing up in email or meetings, give it a Response Flow so TODD can answer it the same way every time.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-10',
      text: 'When something changes in policy or practice, update the answer first, then the linked documents. Keep the story and the proof in sync.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-11',
      text: 'Attach original files to answers when possible. Future you won’t have to hunt through folders to see where the guidance came from.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'kb-rf-12',
      text: 'Use the Preview to read your entry like a teammate. If it feels confusing there, it will feel confusing in the Knowledge Base.',
      category: 'documents',
      page: 'response-flow',
    },
    {
      id: 'documents-1',
      text: 'Keep drafts in TODD until they’re stable. It saves you from hunting through your desktop later.',
      category: 'documents',
    },
    {
      id: 'documents-2',
      text: 'Name documents by purpose, not date. “Client Brief” beats “Notes_Final_v3_Updated”.',
      category: 'documents',
    },
    {
      id: 'documents-3',
      text: 'If a document carries decisions, summarize them at the top. Your future self will thank you.',
      category: 'documents',
    },
    {
      id: 'documents-4',
      text: 'When you upload a file, add a note explaining why it matters. TODD can surface it faster later.',
      category: 'documents',
    },
    {
      id: 'documents-5',
      text: 'Group related documents by project tag. It makes the entire workstream easier to revisit.',
      category: 'documents',
    },
    {
      id: 'documents-6',
      text: 'If a document keeps getting shared, turn it into a template. Reuse beats rewriting.',
      category: 'documents',
    },
    {
      id: 'documents-7',
      text: 'Store video links with context. A clip with no explanation becomes a mystery three weeks later.',
      category: 'documents',
    },
    {
      id: 'documents-8',
      text: 'Delete outdated drafts. A clean document list helps TODD show the useful stuff first.',
      category: 'documents',
    },
    {
      id: 'documents-9',
      text: 'If a file needs feedback, tag it or link it in a task. Documents rarely move on their own.',
      category: 'documents',
    },
    {
      id: 'documents-10',
      text: 'Upload key PDFs to TODD before meetings. Quick access beats searching email threads.',
      category: 'documents',
    },
    {
      id: 'documents-11',
      text: 'Add keywords that describe the document’s role. TODD’s search gets smarter with each one.',
      category: 'documents',
    },
    {
      id: 'documents-12',
      text: 'If a document supports a decision, attach it to that project. It builds a clear story of how work evolved.',
      category: 'documents',
    },
  ];

  getRandomTipText ( category?: DocsTipCategory, page?: string ): string {
    const tip = this.getRandomTip( category, page );
    return tip?.text ?? '';
  }

  /** Get a random tip object, optionally scoped by category and/or page key. */
  getRandomTip ( category?: DocsTipCategory, page?: string ): DocsTip {
    const pool = this.getTipPool( category, page );
    if ( pool.length === 0 ) {
      return {
        id: 'fallback',
        text: 'No tips yet. Add some to DocsTipService to start rotating guidance.',
        category: 'documents',
      };
    }

    return this.pickRandom( pool );
  }

  private getTipPool ( category?: DocsTipCategory, page?: string ): DocsTip[] {
    let pool = this.tips;

    if ( category ) {
      pool = pool.filter( t => t.category === category );
    }

    if ( page ) {
      const scoped = pool.filter( t => t.page === page );
      if ( scoped.length > 0 ) {
        pool = scoped;
      }
    }

    return pool;
  }

  private pickRandom ( pool: DocsTip[] ): DocsTip {
    return pool[Math.floor( Math.random() * pool.length )];
  }
}
