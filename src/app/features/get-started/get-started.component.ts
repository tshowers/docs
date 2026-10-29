import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DkIconComponent } from '../../shared/dk-icon/dk-icon.component';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsSignupDraft, DocsSignupDraftService, STARTER_QUESTIONS, StarterQuestion } from '../../services/docs-signup-draft.service';

type StepKey = 'question' | 'answer' | 'preview' | 'firstName' | 'lastName' | 'company' | 'signUp';

interface Step { key: StepKey; section: number; }

/**
 * Pre-sign-in wizard - the web twin of docs-ios's OnboardingWizardView
 * (see ONBOARDING-PROFILE-BILLING-PLAYBOOK.md). One thing per screen under
 * a 4-segment progress bar whose first segment ("Start") is already done:
 * write a first Q&A answer for the Knowledge Base, then name and company
 * (company name, role and what it does - design 3f, saved to Profile),
 * then sign in. The draft is saved after sign-in by
 * DocsSignupDraftService.submitIfPending() in AuthCallbackComponent.
 * Returning users skip to /login; already signed-in users never see it.
 */
@Component( {
  selector: 'app-get-started',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DkIconComponent],
  templateUrl: './get-started.component.html',
  styleUrl: './get-started.component.css',
} )
export class GetStartedComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
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

  async ngOnInit (): Promise<void> {
    this.title.setTitle( 'Get started — Docs | 16Ahead' );
    this.draft = this.drafts.load();
    // Signed in already: the wizard is only a way to sign up, so skip it.
    if ( await firstValueFrom( this.authService.getUser() ) ) await this.router.navigateByUrl( this.returnUrl );
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

  back (): void {
    if ( this.stepIndex > 0 ) this.stepIndex--;
    this.focus();
  }

  persist (): void {
    this.drafts.save( this.draft );
  }

  /** Back to the page you were on when you chose Sign in (?returnUrl=), else the app - never the sign-in pages themselves, which would loop back here. */
  get returnUrl (): string {
    const returnUrl = String( this.route.snapshot.queryParamMap.get( 'returnUrl' ) || '' ).trim();
    if ( !returnUrl.startsWith( '/' ) || returnUrl.startsWith( '//' ) ) return '/';
    return /^\/(get-started|login)(?=[/?#]|$)/.test( returnUrl ) ? '/' : returnUrl;
  }

  signIn (): void {
    this.isSigningIn = true;
    this.persist();
    this.authService.signIn( this.returnUrl );
  }

  private focus (): void {
    setTimeout( () => this.answerInput?.nativeElement.focus(), 0 );
  }
}
