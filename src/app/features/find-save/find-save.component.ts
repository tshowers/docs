import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocsAuthService } from '../../services/docs-auth.service';

interface FindResult {
  query: string;
  title: string;
  answer: string;
  url: string;
  keywords: string[];
}

/**
 * "Save to Knowledge" from Find (Ty, 2026-10-11). Find (find.taliferro.tech
 * and the Find app) opens /knowledge/save?q=&title=&answer=&url=&keywords=.
 * Signed out, this asks to sign in, and DocsAuthService.signIn(returnUrl)
 * brings the visitor back to this same address. Signed in, it saves through
 * POST /api/response-flows/from-find - no Docs purchase needed - and opens
 * the answer. Without Docs the answer is read-only: its Edit and Delete are
 * appWriteAction buttons, so they offer Docs instead, and the server refuses
 * the change too (kb.service.js, KB_READ_ONLY).
 */
@Component( {
  selector: 'app-find-save',
  standalone: true,
  imports: [CommonModule, RouterModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './find-save.component.html',
  styleUrl: './find-save.component.css',
} )
export class FindSaveComponent implements OnInit {
  private readonly route = inject( ActivatedRoute );
  private readonly router = inject( Router );
  private readonly http = inject( HttpClient );
  private readonly auth = inject( DocsAuthService );

  readonly result = signal<FindResult | null>( null );
  readonly state = signal<'checking' | 'signIn' | 'saving' | 'limit' | 'error'>( 'checking' );
  readonly message = signal( '' );

  async ngOnInit (): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const query = String( params.get( 'q' ) || '' ).trim();
    if ( !query ) {
      this.state.set( 'error' );
      this.message.set( 'There’s nothing from Find to save. Open a result in Find and tap Save to Knowledge.' );
      return;
    }
    this.result.set( {
      query,
      title: String( params.get( 'title' ) || query ).trim(),
      answer: String( params.get( 'answer' ) || '' ).trim(),
      url: String( params.get( 'url' ) || '' ).trim(),
      keywords: String( params.get( 'keywords' ) || '' ).split( ',' ).map( ( word ) => word.trim() ).filter( Boolean ),
    } );

    const signedIn = await firstValueFrom( this.auth.isLoggedIn() );
    if ( !signedIn ) {
      this.state.set( 'signIn' );
      return;
    }
    await this.save();
  }

  signIn (): void {
    this.auth.signIn( this.router.url );
  }

  async save (): Promise<void> {
    const result = this.result();
    if ( !result ) return;
    this.state.set( 'saving' );
    try {
      const response = await firstValueFrom( this.http.post<{ item?: { id?: string } }>(
        `${ environment.backendURL }/response-flows/from-find`, result,
      ) );
      const id = response?.item?.id;
      await this.router.navigate( id ? ['/knowledge', id] : ['/knowledge'], { replaceUrl: true } );
    } catch ( error: any ) {
      const code = error?.error?.code;
      if ( code === 'FIND_SAVE_LIMIT' ) {
        this.state.set( 'limit' );
        this.message.set( error?.error?.message || 'You’ve saved the most answers you can from Find without Docs.' );
        return;
      }
      if ( error?.status === 401 ) {
        this.state.set( 'signIn' );
        return;
      }
      this.state.set( 'error' );
      this.message.set( 'Docs couldn’t save this right now.' );
    }
  }
}
