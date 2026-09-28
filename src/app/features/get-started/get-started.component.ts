import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsSignupDraft, DocsSignupDraftService, STARTER_QUESTIONS, StarterQuestion } from '../../services/docs-signup-draft.service';

type StepKey = 'question' | 'answer' | 'preview' | 'firstName' | 'lastName' | 'company' | 'signUp';

interface Step { key: StepKey; section: number; }

/**
 * Pre-sign-in wizard - the web twin of docs-ios's OnboardingWizardView
 * (see ONBOARDING-PROFILE-BILLING-PLAYBOOK.md). One thing per screen under
 * a 4-segment progress bar whose first segment ("Start") is already done:
 * write a first Q&A answer for the Knowledge Base, then name and company,
 * then sign in. The draft is saved after sign-in by
 * DocsSignupDraftService.submitIfPending() in AuthCallbackComponent.
 * Returning users skip to /login.
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  @ViewChild( 'answerInput' ) answerInput?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  readonly sections = ['Start', 'Your answer', 'About you', 'Sign up'];
  readonly starters = STARTER_QUESTIONS;
  readonly steps: Step[] = [
    { key: 'question', section: 1 },
    { key: 'answer', section: 1 },
    { key: 'preview', section: 1 },
    { key: 'firstName', section: 2 },
    { key: 'lastName', section: 2 },
    { key: 'company', section: 2 },
    { key: 'signUp', section: 3 },
  ];

  draft!: DocsSignupDraft;
  stepIndex = 0;
  isSigningIn = false;

  constructor (
    private readonly title: Title,
    private readonly authService: DocsAuthService,
    readonly drafts: DocsSignupDraftService,
  ) { }

  ngOnInit (): void {
    this.title.setTitle( 'Get started — Docs | Taliferro Tech' );
    this.draft = this.drafts.load();
  }

  get step (): Step {
    return this.steps[Math.min( this.stepIndex, this.steps.length - 1 )];
  }

  get starter (): StarterQuestion {
    return this.drafts.starterFor( this.draft );
  }

  get keywordLine (): string {
    return this.drafts.keywords( this.draft ).map( ( keyword ) => `#${keyword}` ).join( '  ' );
  }

  get isOther (): boolean {
    return this.draft.starterKey === 'other';
  }

  sectionFill ( index: number ): number {
    if ( index < this.step.section ) return 1;
    if ( index > this.step.section ) return 0;
    const siblings = this.steps.filter( ( s ) => s.section === index );
    return ( siblings.indexOf( this.step ) + 1 ) / ( siblings.length + 1 );
  }

  get canAdvance (): boolean {
    switch ( this.step.key ) {
      case 'question': return !!this.draft.question.trim();
      case 'answer': return !!this.draft.answer.trim();
      case 'firstName': return !!this.draft.firstName.trim();
      case 'lastName': return !!this.draft.lastName.trim();
      default: return true;
    }
  }

  chooseStarter ( starter: StarterQuestion ): void {
    this.draft = this.drafts.fromStarter( starter, this.draft );
    this.persist();
    if ( starter.key === 'other' ) this.focus();
  }

  next (): void {
    if ( !this.canAdvance || this.stepIndex >= this.steps.length - 1 ) return;
    this.stepIndex++;
    if ( this.step.key === 'signUp' ) this.draft.readyToSubmit = true;
    this.persist();
    this.focus();
  }

  skip (): void {
    this.stepIndex++;
    if ( this.step.key === 'signUp' ) this.draft.readyToSubmit = true;
    this.persist();
  }

  back (): void {
    if ( this.stepIndex > 0 ) this.stepIndex--;
    this.focus();
  }

  persist (): void {
    this.drafts.save( this.draft );
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( '/docs' );
  }

  private focus (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }
}
