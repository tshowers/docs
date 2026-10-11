import { hasText, normalizeSources, savedAgo, sourceLabel, stripSourceTints, tintedDraftHtml } from './studio-draft';

describe( 'Studio first draft', () => {
  const sources = [
    { kind: 'profile' as const, label: 'Your profile', detail: 'Company description, value proposition' },
    { kind: 'knowledge' as const, label: '3 Knowledge answers', detail: 'Past work and how you do it' },
    { kind: 'opportunity' as const, label: 'King County RFP', detail: 'Scope and requirements' },
  ];

  it( 'groups passages by source into tinted blocks with their labels', () => {
    const html = tintedDraftHtml( 'Capability statement', [
      { type: 'heading', text: 'Who we are', source: '' },
      { type: 'paragraph', text: 'Taliferro builds <portals>.', source: 'profile' },
      { type: 'paragraph', text: 'Since 2014.', source: 'profile' },
      { type: 'paragraph', text: 'We shipped Permit Portal.', source: 'knowledge' },
      { type: 'paragraph', text: 'Thanks.', source: '' },
    ], sources );
    expect( html ).toBe(
      '<h1>Capability statement</h1><h2>Who we are</h2>'
      + '<div class="dk-src" data-src="profile" data-label="From your profile · Company description, value proposition"><p>Taliferro builds &lt;portals&gt;.</p><p>Since 2014.</p></div>'
      + '<div class="dk-src" data-src="knowledge" data-label="From Knowledge · 3 Knowledge answers"><p>We shipped Permit Portal.</p></div>'
      + '<p>Thanks.</p>' );
  } );

  it( 'names the RFP a passage was matched to', () => {
    expect( sourceLabel( 'opportunity', sources ) ).toBe( 'Matched to the King County RFP · Scope and requirements' );
  } );

  it( 'removes the tints and keeps the text', () => {
    const html = tintedDraftHtml( '', [{ type: 'paragraph', text: 'One', source: 'profile' }], sources );
    expect( stripSourceTints( html ) ).toBe( '<p>One</p>' );
    expect( stripSourceTints( '<p>Plain</p>' ) ).toBe( '<p>Plain</p>' );
  } );

  it( 'tells an empty page from one with words', () => {
    expect( hasText( '<p><br></p>' ) ).toBeFalse();
    expect( hasText( '<p>&nbsp;</p>' ) ).toBeFalse();
    expect( hasText( '<p>Hi</p>' ) ).toBeTrue();
  } );

  it( 'keeps only well-formed sources', () => {
    expect( normalizeSources( [{ kind: 'profile', label: 'Your profile' }, { kind: 'other', label: 'x' }, null] ) )
      .toEqual( [{ kind: 'profile', label: 'Your profile', detail: '' }] );
  } );

  it( 'says when it was saved', () => {
    const now = new Date( '2026-10-10T12:00:00Z' );
    expect( savedAgo( '2026-10-10T11:58:00Z', now ) ).toBe( 'saved 2 min ago' );
    expect( savedAgo( '2026-10-10T11:59:50Z', now ) ).toBe( 'saved just now' );
    expect( savedAgo( '', now ) ).toBe( '' );
  } );
} );
