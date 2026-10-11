import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Title } from '@angular/platform-browser';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  COMPANY_DESCRIPTION_CHOICES,
  computeProfileCompletion,
  ProfileCompletion,
  fillProfileChoice,
  MISSION_CHOICES,
  PROFILE_ROLES,
  ProfileChoice,
  ToddProfile,
  VALUE_PROPOSITION_CHOICES,
} from '@taliferro/ui/platform/profile-choices.model';
import { getProfileUrl } from '@taliferro/ui/platform/account-menu.model';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsSignupDraftService } from '../../services/docs-signup-draft.service';
import { ProfileApiService } from '../../services/profile-api.service';
import { FIT_THRESHOLD, Opportunity, fitTint, isOpen } from '../../models/opportunity';
import { OpportunitiesService } from '../../services/opportunities.service';

/** The six fields TODD scores RFPs against (design 3e "Used for fit"). */
export const FIT_FIELDS = ['companyName', 'profession', 'companyDescription', 'jobDescriptionForTODD', 'valueProp', 'companyGoal'] as const;

/** Whether a save changed anything TODD scores against. */
export function fitFieldsChanged ( before: Partial<ToddProfile> | null, after: Partial<ToddProfile> ): boolean {
  return FIT_FIELDS.some( ( key ) => String( before?.[key] ?? '' ).trim() !== String( after[key] ?? '' ).trim() );
}

interface ChoiceField {
  key: 'companyDescription' | 'valueProp' | 'companyGoal';
  title: string;
  hint: string;
  choices: ProfileChoice[];
}

/**
 * Profile (design_handoff_todd_docs 3e): the six fields TODD scores RFPs
 * against come first, then your details; on the right, how TODD uses them
 * and the open opportunities with their scores, which are re-scored after
 * a save that changes the first card.
 *
 * In-app profile management - the web twin of the iOS apps'
 * TODDProfileKit ProfileView, replacing the menu's old link out to
 * todd.taliferro.tech/update-profile. Same fields and one-tap choices
 * (@taliferro/ui/platform/profile-choices.model), same API
 * (ProfileApiService). Advanced settings (products, signature, billing)
 * stay on TODD's own profile page, linked at the bottom.
 */
@Component( {
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
} )
export class ProfileComponent implements OnInit, OnDestroy {
  readonly roles = PROFILE_ROLES;
  readonly choiceFields: ChoiceField[] = [
    { key: 'companyDescription', title: 'Company description', hint: 'What you do, for whom', choices: COMPANY_DESCRIPTION_CHOICES },
    { key: 'valueProp', title: 'Value proposition', hint: 'Why a buyer picks you', choices: VALUE_PROPOSITION_CHOICES },
    { key: 'companyGoal', title: 'Company goal', hint: 'What you\u2019re aiming for this year', choices: MISSION_CHOICES },
  ];
  readonly timezones = this.supportedTimezones();
  readonly toddProfileUrl = getProfileUrl();

  profile: ToddProfile | null = null;
  private savedJson = '';
  isCustomRole = false;
  isSaving = false;
  justSaved = false;
  errorMessage = '';
  isEditing = false;
  isConfirmingDelete = false;
  isDeleting = false;

  /** Open opportunities and their scores, beside the form. */
  rescoring = false;
  savedAt: Date | null = null;
  readonly fitTint = fitTint;

  get openOpportunities (): Opportunity[] {
    return this.opportunities.opportunities()
        .filter( ( o ) => ( o.status === 'new' || o.status === 'drafting' ) && isOpen( o ) )
        .sort( ( a, b ) => b.fit.score - a.fit.score )
        .slice( 0, 6 );
  }

  readonly fitThreshold = FIT_THRESHOLD;

  /** "Dana Reyes · Taliferro Tech" */
  get subtitle (): string {
    if ( !this.profile ) return '';
    return [`${ this.profile.firstName } ${ this.profile.lastName }`.trim(), this.profile.companyName].filter( Boolean ).join( ' · ' );
  }

  choiceValue ( field: ChoiceField ): string {
    return this.profile ? this.profile[field.key] : '';
  }

  setChoiceValue ( field: ChoiceField, value: string ): void {
    if ( this.profile ) this.profile[field.key] = value;
  }

  constructor (
    private readonly opportunities: OpportunitiesService,
    private readonly api: ProfileApiService,
    private readonly authService: DocsAuthService,
    private readonly signupDraft: DocsSignupDraftService,
    private readonly router: Router,
    private readonly title: Title,
  ) { }

  /** null until Firebase reports auth state; false shows the sign-in panel. */
  isSignedIn: boolean | null = null;
  private authSubscription?: Subscription;
  private loadedForUser = false;

  ngOnInit (): void {
    this.title.setTitle( 'Profile — Docs | Taliferro Tech' );
    // React to auth state rather than checking once: a session that finishes
    // signing in after the page loads should still load the profile.
    this.authSubscription = this.authService.isLoggedIn().subscribe( ( signedIn ) => {
      this.isSignedIn = signedIn;
      if ( signedIn && !this.loadedForUser ) {
        this.loadedForUser = true;
        void this.loadProfile();
        this.opportunities.load().subscribe();
      }
    } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  signIn (): void {
    this.authService.signIn( '/profile' );
  }

  private async loadProfile (): Promise<void> {
    try {
      const loaded = await this.api.load();
      if ( !loaded.timezone ) loaded.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      this.setProfile( loaded );
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We could not load your profile.';
    }
  }

  /** Completion of the saved profile (not unsaved edits), same items as iOS. */
  get completion (): ProfileCompletion | null {
    return this.savedJson ? computeProfileCompletion( JSON.parse( this.savedJson ) ) : null;
  }

  get missingSummary (): string {
    return ( this.completion?.missing || [] ).map( ( item ) => item.label.toLowerCase() ).join( ', ' );
  }

  get isDirty (): boolean {
    return !!this.profile && JSON.stringify( this.profile ) !== this.savedJson;
  }

  selectRole ( role: string ): void {
    if ( !this.profile ) return;
    this.isCustomRole = false;
    this.profile.profession = role;
  }

  selectOtherRole (): void {
    if ( !this.profile ) return;
    if ( !this.isCustomRole ) this.profile.profession = '';
    this.isCustomRole = true;
  }

  isChoiceSelected ( field: ChoiceField, choice: ProfileChoice ): boolean {
    return !!this.profile && this.profile[field.key] === fillProfileChoice( choice, this.profile.companyName );
  }

  selectChoice ( field: ChoiceField, choice: ProfileChoice ): void {
    if ( !this.profile ) return;
    this.profile[field.key] = fillProfileChoice( choice, this.profile.companyName );
  }

  timezoneLabel ( zone: string ): string {
    return zone.replace( /_/g, ' ' );
  }

  startEditing (): void {
    if ( !this.profile ) return;
    this.isCustomRole = !!this.profile.profession && !this.roles.includes( this.profile.profession );
    this.isEditing = true;
  }

  cancelEditing (): void {
    if ( this.savedJson ) this.setProfile( JSON.parse( this.savedJson ) );
    this.isEditing = false;
  }

  /** Read-mode display of the timezone, e.g. "America/Los Angeles". */
  get timezoneDisplay (): string {
    return this.profile?.timezone ? this.timezoneLabel( this.profile.timezone ) : '';
  }

  async save (): Promise<void> {
    if ( !this.profile || this.isSaving ) return;
    this.isSaving = true;
    this.errorMessage = '';
    const before = this.savedJson ? JSON.parse( this.savedJson ) as ToddProfile : null;
    try {
      this.setProfile( await this.api.save( this.profile ) );
      this.isEditing = false;
      this.justSaved = true;
      this.savedAt = new Date();
      setTimeout( () => ( this.justSaved = false ), 2000 );
      if ( fitFieldsChanged( before, this.profile! ) && this.openOpportunities.length ) this.rescore();
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We could not save your profile.';
    } finally {
      this.isSaving = false;
    }
  }

  /** TODD re-scores the open opportunities against the saved profile. */
  rescore (): void {
    this.rescoring = true;
    this.opportunities.rescore().subscribe( {
      next: () => { this.rescoring = false; },
      error: () => { this.rescoring = false; },
    } );
  }

  async deleteAccount (): Promise<void> {
    this.isDeleting = true;
    this.errorMessage = '';
    try {
      await this.api.deleteAccount();
      this.signupDraft.clear();
      await this.authService.signOut();
      await this.router.navigateByUrl( '/' );
    } catch ( error: any ) {
      this.errorMessage = error?.error?.message || error?.message || 'We could not delete your account.';
      this.isDeleting = false;
    }
  }

  private setProfile ( profile: ToddProfile ): void {
    this.profile = { ...profile };
    this.savedJson = JSON.stringify( this.profile );
    this.isCustomRole = !!profile.profession && !this.roles.includes( profile.profession );
    if ( profile.timezone && !this.timezones.includes( profile.timezone ) ) {
      this.timezones.unshift( profile.timezone );
    }
  }

  private supportedTimezones (): string[] {
    try {
      const intl = Intl as unknown as { supportedValuesOf?: ( key: string ) => string[] };
      return intl.supportedValuesOf ? [...intl.supportedValuesOf( 'timeZone' )] : [];
    } catch {
      return [];
    }
  }
}
