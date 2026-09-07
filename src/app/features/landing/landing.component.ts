import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, ViewChild } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './landing.component.html',
  styleUrl: '../../shared/product-landing.css'
} )
export class LandingComponent implements AfterViewInit, OnDestroy {
  @ViewChild('docsSection') private docsSection?: ElementRef<HTMLElement>;

  private scrollFrame: number | null = null;
  readonly outcomes = [
    [ 'Reuse', 'TODD surfaces language that has already worked.', 'Past proposals, response flows, and capability statements become reusable content instead of forgotten files.' ],
    [ 'Proposal-ready', 'The right document is ready before the conversation.', 'Docs connects documents to contacts, deals, and campaigns so preparation starts with context.' ],
    [ 'Connected', 'Every document stays linked to the work it supports.', 'Open a contact, campaign, or deal and the documents that belong there are already in reach.' ],
    [ 'Retrievable', 'Find content by what it says, not what you named it.', 'Search the clause, pricing section, or response that you need without remembering a filename.' ]
  ];

  readonly steps = [
    [ '01', 'Add the work that already represents your best thinking' ],
    [ '02', 'Link each document to the deal or campaign it belongs to' ],
    [ '03', 'Let TODD surface the right content when the next opportunity appears' ]
  ];

  readonly faqs = [
    { question: 'What belongs in Docs?', answer: 'Proposals, RFP responses, capability statements, templates, onboarding guides, and any other work you want TODD to find and reuse.' },
    { question: 'Can Docs connect documents to my work?', answer: 'Yes. Documents can stay connected to the contacts, deals, and campaigns they support so the surrounding context is available when you need it.' },
    { question: 'How does TODD use my documents?', answer: 'TODD reads your saved work to surface relevant language, supporting material, and prior answers when a similar opportunity appears.' },
    { question: 'Do I need to organize everything perfectly first?', answer: 'No. Start with the work you already trust. Docs is designed to make useful content easier to find as your library grows.' }
  ];

  ngAfterViewInit (): void {
    window.scrollTo( 0, 0 );
    this.updateDocsSectionTheme();
  }

  @HostListener('window:scroll')
  onWindowScroll (): void {
    if ( this.scrollFrame !== null ) return;

    this.scrollFrame = window.requestAnimationFrame( () => {
      this.scrollFrame = null;
      this.updateDocsSectionTheme();
    } );
  }

  @HostListener('window:resize')
  onWindowResize (): void {
    this.updateDocsSectionTheme();
  }

  ngOnDestroy (): void {
    if ( this.scrollFrame !== null ) window.cancelAnimationFrame( this.scrollFrame );
  }

  private updateDocsSectionTheme (): void {
    const section = this.docsSection?.nativeElement;
    if ( !section ) return;

    const rect = section.getBoundingClientRect();
    const start = window.innerHeight;
    const finish = window.innerHeight * 0.15;
    const progress = Math.min( 1, Math.max( 0, ( start - rect.top ) / ( start - finish ) ) );
    const from = [ 26, 34, 42 ];
    const to = [ 242, 247, 251 ];
    const color = from.map( ( channel, index ) => Math.round( channel + ( to[index] - channel ) * progress ) );
    const headingProgress = Math.min( 1, Math.max( 0, ( progress - 0.45 ) / 0.55 ) );

    section.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
    section.style.setProperty( '--pl-doc-progress', String( progress ) );
    section.style.setProperty( '--pl-heading-progress', String( headingProgress ) );
  }
}
