import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface HelpPillar {
  icon: string;
  title: string;
  copy: string;
}

interface HelpStep {
  number: string;
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
export class HelpComponent {
  readonly audiences: string[] = [
    'Small businesses and teams that bid on contracts and answer RFPs.',
    'Teams that rely on contractors, part-time help, or turnover, and can’t afford to lose what people know when they leave.',
    'Founders and operators whose notes, drafts, PDFs, images, and videos are scattered across email, drives, and chat tools.',
  ];

  readonly differences: HelpPillar[] = [
    {
      icon: 'fa-solid fa-file-signature',
      title: 'From RFP to first draft',
      copy: 'Upload an RFP and TODD drafts a proposal from it, so you start editing instead of starting from a blank page.',
    },
    {
      icon: 'fa-solid fa-brain',
      title: 'Knowledge stays when people leave',
      copy: 'Response Flow captures the questions your team answers, with sourced answers and evidence, and keeps them in the Knowledge Base for the next person.',
    },
    {
      icon: 'fa-solid fa-photo-film',
      title: 'One home for every kind of file',
      copy: 'RFP source files, drafts, notes, PDFs, images, videos, and music live in one searchable vault instead of five different tools.',
    },
  ];

  readonly steps: HelpStep[] = [
    {
      number: '01',
      title: 'Sign in and add your first file',
      copy: 'Docs gets useful as soon as it has something of yours in it. Start with one file you actually use, such as an RFP you received, a past proposal, or a capability statement.',
      details: [
        'Sign in so Docs can save your work. Guests can look around, but nothing is saved.',
        'Open Upload and choose a file or drag it into the upload area.',
        'Give it a clear name and any context, then wait for it to finish processing.',
        'Your file now appears in My Documents, ready to search and reuse.',
      ],
      route: '/docs/upload',
      action: 'Upload your first file',
    },
    {
      number: '02',
      title: 'Keep everything in your document vault',
      copy: 'My Documents is your searchable library for PDFs, images, videos, music, Word documents, and other files TODD should know about.',
      details: [
        'Search by title, topic, author, or type.',
        'Use Add Document to store another file at any time.',
        'Open a document to see its details, or use its actions to edit and manage it.',
        'Documents can also be attached to a contact from that contact’s actions menu.',
      ],
      route: '/docs/documents',
      action: 'Open My Documents',
    },
    {
      number: '03',
      title: 'Write notes and drafts in Document Studio',
      copy: 'Document Studio is where you jot down thoughts, write drafts, and ask TODD to improve them. It’s the place for work that isn’t finished yet.',
      details: [
        'Paste text directly into the editor or drag in a .docx file.',
        'Tell TODD what you want, such as fix grammar, sound more professional, make it shorter, expand it, turn it into bullets, or summarize it.',
        'Choose Preview Changes to review TODD’s revision before you accept it.',
        'Save it as a document or draft, then export to Word or PDF, or copy the text.',
      ],
      route: '/docs/editor',
      action: 'Open Document Studio',
    },
    {
      number: '04',
      title: 'Turn an RFP into a proposal',
      copy: 'Docs keeps RFPs, deadlines, and proposal drafts together, and TODD can read an RFP and draft the response for you.',
      details: [
        'Upload an RFP (PDF or Word) with the agency name, title, due date, and any notes or tags.',
        'Find it again in RFPs and open the source file when you need it.',
        'Click the Generate Proposal icon on an RFP to have TODD draft a response.',
        'Use Proposal History to see proposals TODD has started or finished and open the draft.',
        'Keep due dates up to date so urgent opportunities stand out.',
      ],
      route: '/docs/rfp-list',
      action: 'Open RFPs',
    },
    {
      number: '05',
      title: 'Capture what your team knows',
      copy: 'When someone answers a question well, save it. The Knowledge Base keeps answers, evidence, and sources so the knowledge stays with the business, not with whoever wrote it.',
      details: [
        'Choose Add Knowledge Item to open Response Flow, a step-by-step guide for capturing knowledge.',
        'Write the question, add one or more answers, and attach supporting documents or source links.',
        'Add recommendations and resources, then tag the entry with keywords so it’s easy to find.',
        'Save it as a draft if it isn’t ready yet, or submit it when the answer and evidence are complete.',
        'Search the Knowledge Base whenever the same question comes up again.',
      ],
      route: '/knowledge',
      action: 'Open Knowledge Base',
    },
    {
      number: '06',
      title: 'Check your workspace at Docs Home',
      copy: 'Once you have some documents and knowledge saved, Docs Home gives you an overview of your workspace: what’s being used, what’s out of date, what’s duplicated, and what’s ready to reuse.',
      details: [
        'Check the health meters to see how your workspace is doing at a glance.',
        'Each row names a problem, such as stale or duplicate files, and what TODD suggests doing about it.',
        'Use the shortcuts to jump to Documents, Knowledge Base, or the related task.',
      ],
      route: '/docs',
      action: 'Open Docs Home',
    },
  ];

  readonly faqs: HelpFaq[] = [
    {
      question: 'Who or what is TODD?',
      answer: 'TODD is the AI assistant built into Docs. It improves your drafts, writes proposals from RFPs, and answers questions about the page you’re on. Docs is one of the workspaces TODD powers.',
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
