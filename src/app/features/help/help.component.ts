import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DocsAuthService } from '../../services/docs-auth.service';
import { GettingStarted, GettingStartedService, GettingStartedStep } from '../../services/getting-started.service';

interface HelpStep {
  number: string;
  tint: string;
  title: string;
  copy: string;
  details: string[];
  route: string;
  action: string;
}

interface HelpFaq {
  question: string;
  answer: string;
}

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './help.component.html',
  styleUrl: './help.component.css',
})
export class HelpComponent implements OnInit {
  /** Signed-in only: the Getting Started checklist, checked off from real data. */
  progress: GettingStarted | null = null;
  showAfterSignIn = true;

  constructor (
    private readonly authService: DocsAuthService,
    readonly gettingStarted: GettingStartedService,
  ) { }

  ngOnInit (): void {
    this.showAfterSignIn = this.gettingStarted.showAfterSignIn;
    this.authService.getUserId().subscribe( ( userId ) => {
      if ( !userId ) {
        this.progress = null;
        return;
      }
      this.gettingStarted.load().then( ( progress ) => ( this.progress = progress ) ).catch( () => ( this.progress = null ) );
    } );
  }

  toggleShowAfterSignIn ( value: boolean ): void {
    this.showAfterSignIn = value;
    this.gettingStarted.showAfterSignIn = value;
  }

  trackStep ( _index: number, step: GettingStartedStep ): string {
    return step.id;
  }

  /** The step nav: which step is in view. */
  activeStep = '01';

  goToStep ( number: string ): void {
    this.activeStep = number;
    document.getElementById( `step-${ number }` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  /** The first session, step by step (design 2c), rewritten for the four tabs. */
  readonly steps: HelpStep[] = [
    {
      number: '01',
      tint: 'blue',
      title: 'Sign in and add your first file',
      copy: 'Docs gets useful as soon as it has something of yours in it. Start with one file you actually use, such as an RFP you received, a past proposal, or a capability statement.',
      details: [
        'Sign in so Docs can save your work. Guests can look around, but nothing is saved.',
        'Choose New, then Add files, or drag a file onto the Add files page.',
        'Docs gives it a readable name and a folder. An RFP goes straight to Opportunities, scored against your profile.',
      ],
      route: '/upload',
      action: 'Add your first file',
    },
    {
      number: '02',
      tint: 'cyan',
      title: 'Find anything in Documents',
      copy: 'Documents is your searchable library for PDFs, images, videos, music, Word documents, and other files TODD should know about.',
      details: [
        'Search by what a file says, not just its name.',
        'Filter by RFPs, Proposals, Contracts, Pricing, Compliance or Media.',
        'Open a file to see its preview, details and what it’s connected to.',
      ],
      route: '/documents',
      action: 'Open Documents',
    },
    {
      number: '03',
      tint: 'violet',
      title: 'Turn an RFP into a proposal',
      copy: 'Connect the inbox where your RFP alerts arrive, from OpenGov, King County, Bonfire and others, or add the RFP file yourself. Use a semi-dedicated inbox, like bids@yourcompany.com: TODD reads only the senders you list and never marks anything read. It scores each RFP against your profile.',
      details: [
        'Opportunities lists RFPs that fit you, why they fit and what’s missing.',
        'Choose Draft proposal. TODD writes what it can from your profile and Knowledge.',
        'The RFP checklist tracks page limits, formatting and required attachments.',
        'Review & send emails it from your own inbox to the address the RFP asks for, or packages it for a portal.',
      ],
      route: '/opportunities',
      action: 'Open Opportunities',
    },
    {
      number: '04',
      tint: 'green',
      title: 'Answer TODD’s questions',
      copy: 'When a proposal asks something Docs doesn’t know yet, TODD asks you in the editor. Each answer is saved to Knowledge, so you only answer it once.',
      details: [
        'Answer in your own words. TODD adds the keywords and category.',
        'Untick Save to Knowledge if the answer only applies to this proposal.',
        'Answers keep a record of every proposal that used them.',
      ],
      route: '/opportunities',
      action: 'See your proposals',
    },
    {
      number: '05',
      tint: 'pink',
      title: 'Keep Knowledge current',
      copy: 'Knowledge holds every answer, with its evidence, recommendations and resources. TODD flags answers that are over a year old.',
      details: [
        'Search Knowledge the same way you search Documents.',
        'Open an answer to confirm it, edit it or turn it into a post.',
        'You can still add an answer yourself from Knowledge.',
      ],
      route: '/knowledge',
      action: 'Open Knowledge',
    },
    {
      number: '06',
      tint: 'yellow',
      title: 'Write something new',
      copy: 'New starts any document: a cover letter, a capability statement, an edit of a Word file, or a blank page. Say what you’re writing and TODD picks the sources.',
      details: [
        'Ask TODD to fix grammar, shorten, expand or summarize.',
        'Preview TODD’s changes before you accept them.',
        'Export to Word or PDF, or copy the text.',
      ],
      route: '/new',
      action: 'Start a document',
    },
  ];

  readonly faqs: HelpFaq[] = [
    {
      question: 'Who or what is TODD?',
      answer: 'TODD is the AI assistant built into Docs. It improves your drafts, writes proposals from RFPs, and answers questions about the page you’re on. Docs is one of the workspaces TODD powers.',
    },
    {
      question: 'Where do my RFPs come from?',
      answer: 'From an inbox you connect on Opportunities (RFP inbox). Use a semi-dedicated one, like bids@yourcompany.com, where your OpenGov, Bonfire, King County or city portal alerts arrive. Every 10 minutes TODD reads only the messages from the senders you list, never marks anything read and never moves or deletes mail, then scores each RFP against your profile. You can also add an RFP file yourself with Add an RFP.',
    },
    {
      question: 'Why a semi-dedicated inbox?',
      answer: 'TODD finds RFPs by watching for alert emails. In an inbox that\'s mostly alerts, none get buried, and your personal mail stays out of the picture. If your alerts already arrive at a shared address like info@, you can connect that; Outreach and Docs can use the same inbox.',
    },
    {
      question: 'Do I need an account to try Docs?',
      answer: 'No. You can explore every page as a guest. To upload files, save drafts, or add knowledge, sign in so your work is saved to your workspace.',
    },
    {
      question: 'Is Docs free?',
      answer: 'You can start for free with a small number of documents and knowledge entries. When you need more room, upgrade from the pricing page.',
    },
    {
      question: 'Is the Knowledge Base part of Docs?',
      answer: 'Yes. The Knowledge Base and Response Flow come with Docs. Use them together to go from files to reusable answers.',
    },
    {
      question: 'What kinds of files can I store?',
      answer: 'My Documents accepts PDFs, Word documents, images, videos, music, and other files. RFP upload accepts PDF and Word files, and Document Studio opens Word (.docx) files.',
    },
    {
      question: 'What is Response Flow?',
      answer: 'Response Flow is the step-by-step form you use to add a knowledge item. It walks you through the question, answers, evidence, recommendations, resources, and keywords so every entry is complete and easy to find later.',
    },
  ];
}
