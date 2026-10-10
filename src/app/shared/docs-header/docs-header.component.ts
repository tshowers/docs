import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter, map } from 'rxjs/operators';

import { currentTheme, toggleTheme, ThemeMode } from '@taliferro/ui/platform/theme';
import { environment } from '../../../environments/environment';
import { DocsAuthService } from '../../services/docs-auth.service';
import { PlatformMenuComponent } from '../platform-menu/platform-menu.component';

type DocsTabId = 'home' | 'opportunities' | 'documents' | 'knowledge' | 'about' | 'help';

interface DocsTab {
  id: DocsTabId;
  label: string;
  route: string;
  icon: string;
}

/** Lucide paths (stroke 2.75, round caps), from design_handoff_todd_docs. */
const ICONS: Record<string, string> = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  folder: '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  help: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/>',
};

const APP_TABS: DocsTab[] = [
  { id: 'home', label: 'Home', route: '/docs', icon: 'home' },
  { id: 'opportunities', label: 'Opportunities', route: '/opportunities', icon: 'inbox' },
  { id: 'documents', label: 'Documents', route: '/documents', icon: 'folder' },
  { id: 'knowledge', label: 'Knowledge', route: '/knowledge', icon: 'book' },
];

const SIGNED_OUT_TABS: DocsTab[] = [
  { id: 'home', label: 'Home', route: '/docs', icon: 'home' },
  { id: 'about', label: 'About', route: '/about', icon: 'info' },
  { id: 'help', label: 'Help', route: '/help', icon: 'help' },
];

/**
 * Which tab a URL belongs to. Prefix-based so the pages the redesign folds
 * into a tab (RFP list, proposal history, upload...) light up the right one
 * while they still live at their old addresses.
 */
export function docsTabForUrl ( url: string ): DocsTabId | null {
  const path = ( url || '' ).split( /[?#]/ )[0];
  if ( path === '/docs' || path === '/docs/' ) return 'home';
  if ( /^\/(opportunities|docs\/(rfp-list|rfp-upload|proposal-history))(\/|$)/.test( path ) ) return 'opportunities';
  if ( /^\/(documents|upload|new|docs\/(documents|upload|editor))(\/|$)/.test( path ) ) return 'documents';
  if ( /^\/knowledge(\/|$)/.test( path ) ) return 'knowledge';
  if ( path === '/' || /^\/about(\/|$)/.test( path ) ) return 'about';
  if ( /^\/help(\/|$)/.test( path ) ) return 'help';
  return null;
}

/**
 * The Docs header on every screen (design_handoff_todd_docs, "Docs Header"):
 * brand left, the four tabs centered, New + Light/Dark + Menu right. Signed
 * out, the tabs become Home / About / Help and New becomes Sign in. On a
 * tablet New and the theme pill turn into circles; on a phone the tabs move
 * to a bottom bar and the brand shows the page title.
 */
@Component( {
  selector: 'app-docs-header',
  standalone: true,
  imports: [RouterLink, PlatformMenuComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    :host { display: block; }
    .ah { display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; padding: 20px 40px; }
    .ah-brand { justify-self: start; gap: 10px; }
    .ah-logo { width: 34px; height: 34px; }
    .ah-name { font-size: 22px; }
    .ah-name small { font-weight: 700; margin-left: 4px; }
    .ah-actions { justify-self: end; gap: 8px; margin-left: 0; }

    .dh-tabs { display: flex; gap: 6px; }
    .dh-tab {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px;
      font-size: 14px; font-weight: 600; color: var(--text) !important; text-decoration: none !important;
    }
    .dh-tab:hover, .dh-tab.is-active { background: var(--surface); }
    .dh-tab:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    .dh-badge {
      display: inline-flex; align-items: center; justify-content: center; min-width: 20px; height: 20px;
      padding: 0 6px; box-sizing: border-box; border-radius: 999px; background: var(--blue); color: #fff;
      font-size: 11px; font-weight: 700;
    }

    /* <i>, not <span>: app-header.css hides every span in the theme pill on a phone. */
    .dh-icon { display: inline-flex; flex: none; font-style: normal; }
    .dh-icon ::ng-deep svg {
      width: 100%; height: 100%; fill: none; stroke: currentColor; stroke-width: 2.75;
      stroke-linecap: round; stroke-linejoin: round;
    }

    .dh-primary, button.dh-primary {
      display: inline-flex; align-items: center; gap: 6px; height: 42px; min-height: 0; padding: 0 18px;
      border: 0; border-radius: 999px; background: var(--blue); color: #fff !important; box-shadow: none;
      font: 700 14px/1 var(--font); text-decoration: none !important; cursor: pointer; white-space: nowrap;
    }
    .dh-primary:hover { filter: brightness(.95); transform: none; }
    .dh-primary:focus-visible { outline: 2px solid var(--blue); outline-offset: 2px; }
    .dh-round { display: none; width: 44px; height: 44px; padding: 0; justify-content: center; border-radius: 50%; }
    .ah-actions .ah-theme { height: 42px; padding: 0 16px; font-size: 14px; }
    .ah-actions ::ng-deep .um-trigger { height: 42px; font-size: 14px; }
    .dh-title { display: none; }
    .dh-bottom { display: none; }

    /* Tablet: New and the theme pill become 44px circles; tabs stay. */
    @media (max-width: 1100px) {
      .ah { padding: 20px 28px; gap: 12px; }
      .ah-logo { width: 32px; height: 32px; border-radius: 9px; }
      .ah-name { font-size: 20px; }
      .dh-tabs { gap: 4px; }
      .dh-tab { padding: 8px 12px; }
      .ah-actions .dh-new-wide:not(button) { display: none; }
      .ah-actions .dh-round { display: inline-flex; }
      .ah-actions .ah-theme { width: 44px; height: 44px; padding: 0; justify-content: center; }
      .ah-actions .ah-theme .dh-theme-label { display: none; }
      .ah-actions ::ng-deep .um-trigger { height: 44px; }
    }

    /* Phone: icon + page title, theme circle, Menu; tabs move to the bottom bar. */
    @media (max-width: 760px) {
      .ah { grid-template-columns: 1fr auto; gap: 8px; padding: calc(10px + env(safe-area-inset-top)) 16px 10px; }
      .dh-center, .ah-actions .dh-round, .ah-actions .dh-new-wide { display: none; }
      .ah-name { display: none; }
      .dh-title { display: inline; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; }
      .ah-actions .ah-theme { width: 44px; height: 44px; }
      .dh-bottom {
        display: grid; grid-template-columns: repeat(var(--dh-cols, 4), 1fr);
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 20;
        padding: 6px 8px calc(6px + env(safe-area-inset-bottom));
        background: var(--bg); box-shadow: 0 -1px 0 var(--surface2);
      }
      .dh-bottom a {
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        min-height: 52px; font-size: 11px; font-weight: 600; color: var(--muted) !important; text-decoration: none !important;
      }
      .dh-bottom a.is-active { color: var(--blue-ink) !important; font-weight: 700; }
    }
  `],
  template: `
    <header class="ah">
      <a class="ah-brand" routerLink="/docs" aria-label="TODD Docs home">
        <img class="ah-logo" src="assets/todd-docs-icon.png" alt="" />
        <span class="ah-name">TODD<small>Docs</small></span>
        <span class="dh-title">{{ pageTitle() }}</span>
      </a>

      <div class="dh-center">
        <nav class="dh-tabs" aria-label="Docs">
          @for (tab of tabs(); track tab.id) {
            <a class="dh-tab" [routerLink]="tab.route" [class.is-active]="activeTab() === tab.id" [attr.aria-current]="activeTab() === tab.id ? 'page' : null">
              {{ tab.label }}
              @if (tab.id === 'opportunities' && opportunityCount()) { <span class="dh-badge">{{ opportunityCount() }}</span> }
            </a>
          }
        </nav>
      </div>

      <div class="ah-actions">
        @if (signedIn()) {
          <a class="dh-primary dh-new-wide" routerLink="/new"><span class="dh-icon" style="width:16px;height:16px" [innerHTML]="icon('plus')"></span>New</a>
          <a class="dh-primary dh-round" routerLink="/new" aria-label="New"><span class="dh-icon" style="width:16px;height:16px" [innerHTML]="icon('plus')"></span></a>
        } @else {
          <button type="button" class="dh-primary dh-new-wide" (click)="signIn()">Sign in</button>
        }
        <button type="button" class="ah-pill ah-theme" (click)="flipTheme()" [attr.aria-label]="theme() === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <i class="dh-icon" style="width:16px;height:16px" [innerHTML]="icon(theme() === 'dark' ? 'sun' : 'moon')"></i><span class="dh-theme-label">{{ theme() === 'dark' ? 'Light' : 'Dark' }}</span>
        </button>
        <app-platform-menu [isAdmin]="isAdmin()" [isLoggedIn]="signedIn()" [userName]="userName()" [userEmail]="userEmail()" (signOut)="onSignOut()" />
      </div>
    </header>

    <nav class="dh-bottom" aria-label="Docs" [style.--dh-cols]="tabs().length">
      @for (tab of tabs(); track tab.id) {
        <a [routerLink]="tab.route" [class.is-active]="activeTab() === tab.id" [attr.aria-current]="activeTab() === tab.id ? 'page' : null">
          <span class="dh-icon" style="width:22px;height:22px" [innerHTML]="icon(tab.icon)"></span>{{ tab.label }}
        </a>
      }
    </nav>
  `,
} )
export class DocsHeaderComponent {
  private readonly router = inject( Router );
  private readonly route = inject( ActivatedRoute );
  private readonly auth = inject( DocsAuthService );
  private readonly sanitizer = inject( DomSanitizer );
  private readonly iconCache = new Map<string, SafeHtml>();

  readonly theme = signal<ThemeMode>( currentTheme() );
  /** The Opportunities badge: RFPs that fit and still need a decision. Null hides it. */
  readonly opportunityCount = signal<number | null>( null );

  private readonly user = toSignal( this.auth.getUser(), { initialValue: null } );
  readonly signedIn = computed( () => !!this.user() );
  readonly userName = computed( () => this.user()?.displayName || '' );
  readonly userEmail = computed( () => this.user()?.email || '' );
  readonly isAdmin = computed( () => this.user()?.uid === environment.taliferroTenantId );
  readonly tabs = computed( () => this.signedIn() ? APP_TABS : SIGNED_OUT_TABS );

  private readonly routeState = toSignal(
    this.router.events.pipe(
      filter( ( event ) => event instanceof NavigationEnd ),
      map( () => {
        let child = this.route.firstChild;
        while ( child?.firstChild ) child = child.firstChild;
        return { title: ( child?.snapshot.data['pageTitle'] as string ) || '', url: this.router.url };
      } ),
    ),
    { initialValue: { title: '', url: this.router.url } },
  );

  readonly activeTab = computed( () => docsTabForUrl( this.routeState().url ) );
  readonly pageTitle = computed( () => {
    const explicit = this.routeState().title;
    if ( explicit ) return explicit;
    const tab = APP_TABS.find( ( item ) => item.id === this.activeTab() ) || SIGNED_OUT_TABS.find( ( item ) => item.id === this.activeTab() );
    return tab && tab.id !== 'home' ? tab.label : 'Docs';
  } );

  icon ( name: string ): SafeHtml {
    if ( !this.iconCache.has( name ) ) {
      this.iconCache.set( name, this.sanitizer.bypassSecurityTrustHtml( `<svg viewBox="0 0 24 24" aria-hidden="true">${ ICONS[name] || '' }</svg>` ) );
    }
    return this.iconCache.get( name )!;
  }

  flipTheme (): void {
    this.theme.set( toggleTheme() );
  }

  signIn (): void {
    this.auth.signIn( '/docs' );
  }

  async onSignOut (): Promise<void> {
    await this.auth.signOut();
    await this.router.navigateByUrl( '/' );
  }
}
