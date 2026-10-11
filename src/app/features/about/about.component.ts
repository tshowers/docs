import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterModule } from '@angular/router';


/**
 * About Docs (design_handoff_todd_docs 2b): Find's About layout with the
 * landing page's copy, verbatim - hero, the problem, what Docs gives you,
 * how it works, FAQ (first open) and the closing call to action.
 */
@Component( {
  selector: 'app-about',
  standalone: true,
  imports: [RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './about.component.html',
  styleUrl: './about.component.css',
} )
export class AboutComponent {
  readonly problems = [
    'Your best language is buried in a past proposal.',
    'Cloud storage will not tell you which document won.',
    'Preparation starts from scratch because context is disconnected.',
  ];

  readonly outcomes = [
    { tag: 'Reuse', tint: 'blue', title: 'TODD surfaces language that has already worked.', copy: 'Past proposals, response flows, and capability statements become reusable content instead of forgotten files.' },
    { tag: 'Proposal-ready', tint: 'violet', title: 'The right document is ready before the conversation.', copy: 'Docs connects documents to contacts, deals, and campaigns so preparation starts with context.' },
    { tag: 'Connected', tint: 'pink', title: 'Every document stays linked to the work it supports.', copy: 'Open a contact, campaign, or deal and the documents that belong there are already in reach.' },
    { tag: 'Retrievable', tint: 'cyan', title: 'Find content by what it says, not what you named it.', copy: 'Search the clause, pricing section, or response that you need without remembering a filename.' },
  ];

  readonly steps = [
    { n: '01', text: 'Add the work that already represents your best thinking' },
    { n: '02', text: 'Link each document to the deal or campaign it belongs to' },
    { n: '03', text: 'Let TODD surface the right content when the next opportunity appears' },
  ];

  readonly faqs = [
    { question: 'What belongs in Docs?', answer: 'Proposals, RFP responses, capability statements, templates, onboarding guides, and any other work you want TODD to find and reuse.' },
    { question: 'Can Docs connect documents to my work?', answer: 'Yes. Documents can stay connected to the contacts, deals, and campaigns they support so the surrounding context is available when you need it.' },
    { question: 'How does TODD use my documents?', answer: 'TODD reads your saved work to surface relevant language, supporting material, and prior answers when a similar opportunity appears.' },
    { question: 'Do I need to organize everything perfectly first?', answer: 'No. Start with the work you already trust. Docs is designed to make useful content easier to find as your library grows.' },
  ];

  /** The FAQ accordion: the first answer starts open. */
  readonly open = signal<number>( 0 );

  toggle ( index: number ): void {
    this.open.set( this.open() === index ? -1 : index );
  }
}
