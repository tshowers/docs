import { CommonModule } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
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
  /** The help video for this step, if there is one. */
  video?: number;
}

interface HelpVideo {
  /** help-video-{n}.mp4 in public/video (kept out of git; deployed with Hosting). */
  n: number;
  title: string;
  summary: string;
  length: string;
  /** False until the right file is in place. */
  ready: boolean;
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

  /** Short walkthroughs, one per step of a proposal's life. */
  readonly videos: HelpVideo[] = [
    { n: 1, title: 'Docs in a minute', summary: 'Home, the four tabs, and what TODD does on each.', length: '0:45', ready: true },
    { n: 2, title: 'Connect the inbox TODD watches for RFPs', summary: 'TODD finds RFPs in your email and scores each one.', length: '1:02', ready: true },
    { n: 3, title: 'Is this RFP worth bidding?', summary: 'Fit, must-haves, scoring and key dates, then decide.', length: '1:16', ready: true },
    { n: 4, title: 'Draft the proposal with TODD', summary: 'TODD plans it, drafts each section, and asks what it doesn’t know.', length: '1:20', ready: true },
    { n: 5, title: 'Review & send', summary: 'The checklist, the score check, and sending from your own email.', length: '1:07', ready: true },
    { n: 6, title: 'Get approval before sending', summary: 'A private link for each approver, no account needed.', length: '1:30', ready: true },
    { n: 7, title: 'Documents and Knowledge', summary: 'Your files, and the answers TODD reuses.', length: '0:56', ready: true },
    { n: 8, title: 'After you submit', summary: 'Replies, oral presentations, and how it went.', length: '0:45', ready: true },
  ];

  readonly readyVideos = this.videos.filter( ( v ) => v.ready );

  /** The video playing in the player, if any. */
  playing: HelpVideo | null = null;

  videoFor ( n?: number ): HelpVideo | null {
    return this.videos.find( ( v ) => v.n === n && v.ready ) || null;
  }

  videoSrc ( v: HelpVideo ): string {
    return `/video/help-video-${ v.n }.mp4`;
  }

  posterSrc ( v: HelpVideo ): string {
    return `/video/help-video-${ v.n }-poster.jpg`;
  }

  play ( v: HelpVideo | null ): void {
    this.playing = v;
  }

  @HostListener( 'document:keydown.escape' )
  closePlayer (): void {
    this.playing = null;
  }

  /** The step nav: which step is in view. */
  activeStep = '01';

  goToStep ( number: string ): void {
    this.activeStep = number;
    document.getElementById( `step-${ number }` )?.scrollIntoView( { behavior: 'smooth', block: 'start' } );
  }

  /** The first session, step by step (design 2c), following a proposal from inbox to award. */
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
      video: 1,
    },
    {
      number: '02',
      tint: 'cyan',
      title: 'Connect the inbox TODD watches for RFPs',
      copy: 'Connect the inbox where your RFP alerts arrive, from OpenGov, King County, Bonfire and others. Use a semi-dedicated inbox, like bids@yourcompany.com: TODD reads only the senders you list and never marks anything read.',
      details: [
        'On Opportunities, choose Connect an inbox. Sign in with Google, or use an app password.',
        'Each RFP TODD finds shows up in Opportunities with a fit score and the reasons for it.',
        'No inbox? Choose Add an RFP and upload the file yourself.',
      ],
      route: '/opportunities/inbox',
      action: 'Connect an inbox',
      video: 2,
    },
    {
      number: '03',
      tint: 'violet',
      title: 'Decide whether to bid',
      copy: 'Saying no early saves you a long bid you can’t win. Open an opportunity to see its fit score, the must-haves TODD checked, what they’ll score you on and the key dates.',
      details: [
        'Answer the must-haves TODD couldn’t check from your profile.',
        'Only have the alert email? Attach the RFP so TODD can read the whole thing.',
        'Choose Draft proposal to bid, or Not for us. TODD keeps your reason with the opportunity.',
      ],
      route: '/opportunities',
      action: 'Open Opportunities',
      video: 3,
    },
    {
      number: '04',
      tint: 'green',
      title: 'Draft the proposal with TODD',
      copy: 'TODD plans the proposal from the RFP’s own sections and scoring, then drafts each section from your profile and Knowledge. The “TODD is working” note in the corner shows what it’s writing and about how long it will take.',
      details: [
        'When TODD needs something it doesn’t know, it asks you. Each answer goes into the draft and into Knowledge, so you answer it once.',
        'Requirements lists every requirement in the RFP and where the proposal answers it.',
        'Choose Edit in editor for your own changes.',
      ],
      route: '/opportunities',
      action: 'See your proposals',
      video: 4,
    },
    {
      number: '05',
      tint: 'yellow',
      title: 'Review & send',
      copy: 'Review & send shows exactly what the buyer gets: the email TODD wrote, the proposal PDF and the attachments it found in Documents. The RFP checklist and a score check run before you send.',
      details: [
        'Send proposal goes from your own email, as you, to the address the RFP asks for.',
        'Portal-only RFPs: Download package, upload it on the portal, then choose I’ve submitted it.',
      ],
      route: '/opportunities',
      action: 'Open Opportunities',
      video: 5,
    },
    {
      number: '06',
      tint: 'pink',
      title: 'Get approval before sending',
      copy: 'Want a second look first? On Review & send, choose Get approval. Add anyone by name or email, including people outside your company. They don’t need a TODD account.',
      details: [
        'Each person gets a private link. Copy it, or send it from your own email or Messages. TODD doesn’t email them.',
        'They read the proposal, comment or suggest edits, and approve or request changes.',
        'Send unlocks once it’s approved. If you change anything after that, choose Ask for approval again; they see only what changed.',
        'In a hurry? Send without approval asks for a reason and keeps it with the proposal.',
      ],
      route: '/opportunities',
      action: 'Open Opportunities',
      video: 6,
    },
    {
      number: '07',
      tint: 'blue',
      title: 'After you submit',
      copy: 'The opportunity keeps going after you send. Log replies from the buyer, prepare for an oral presentation, and record how it went.',
      details: [
        'They replied: keep the buyer’s questions and your answers together.',
        'Oral presentation: Download prep sheet with likely questions, and Add to calendar.',
        'How did it go? Record won, lost or cancelled, so TODD learns what you win.',
      ],
      route: '/opportunities',
      action: 'Open Opportunities',
      video: 8,
    },
    {
      number: '08',
      tint: 'cyan',
      title: 'Documents and Knowledge',
      copy: 'Documents is your searchable library for every file TODD can use. Knowledge holds your saved answers about the company, which TODD reuses in every proposal.',
      details: [
        'Search Documents by what a file says, not just its name, and filter by RFPs, Proposals, Contracts, Pricing, Compliance or Media.',
        'Open an answer in Knowledge to confirm it or edit it. TODD flags answers that are over a year old.',
        'Answers you save from Find with Save to Knowledge land here marked “via Find”. Saving from Find is free; editing or deleting them needs Docs.',
      ],
      route: '/knowledge',
      action: 'Open Knowledge',
      video: 7,
    },
    {
      number: '09',
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
      question: 'How do I know TODD is working on something?',
      answer: 'A button shows a spinner as soon as you press it, until its work is done. For anything that takes longer, a “TODD is working” note in the bottom-left corner says what TODD is doing, how far along it is and about how long is left, on any page. Click it to go back. When it finishes, you get a short message saying so.',
    },
    {
      question: 'Can someone outside my company approve a proposal?',
      answer: 'Yes. On Review & send, choose Get approval and add them by email or just by name. They get a private link that opens only that proposal, with no account or sign-in. The link stops working when the RFP closes, or when you remove them.',
    },
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
