import { DocsInbox, Opportunity } from '../../models/opportunity';

/** Mirrors the server's check: proposals never go to a no-reply sender. */
export function isNoReply ( email: string ): boolean {
  return /(^|[._-])(no-?reply|do-?not-?reply|donotreply|noreply|mailer-daemon|notifications?)([._-]|@)/i.test( String( email || '' ).trim() );
}

export function isEmail ( value: string ): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( String( value || '' ).trim() );
}

/** "RFP 2026-118 Permit Portal Modernization — Taliferro Tech" */
export function defaultSubject ( o: Pick<Opportunity, 'solicitationNumber' | 'title'>, company: string ): string {
  return [o.solicitationNumber, o.title].filter( Boolean ).join( ' ' ) + ( company ? ` — ${ company }` : '' );
}

/** TODD's short cover email, signed by the person sending. */
export function defaultBody ( o: Pick<Opportunity, 'agency' | 'solicitationNumber' | 'title'>, sender: { name: string; company: string }, attachmentNames: string[] ): string {
  const what = [o.solicitationNumber, o.title].filter( Boolean ).join( ', ' );
  const others = attachmentNames.slice( 1 );
  const attached = !others.length ? 'The proposal is attached.'
    : others.length === 1 ? `The proposal and ${ others[0] } are attached.`
    : `The proposal, ${ others.slice( 0, -1 ).join( ', ' ) } and ${ others[others.length - 1] } are attached.`;
  return [
    `Dear ${ o.agency ? `${ o.agency } ` : '' }Procurement,`,
    '',
    `${ sender.company || 'We' } ${ sender.company ? 'is' : 'are' } pleased to submit our proposal for ${ what || 'your solicitation' }. ${ attached }`,
    '',
    'Please let me know if you need anything else.',
    '',
    sender.name,
    sender.company,
  ].filter( ( line, index, all ) => !( line === '' && all[index - 1] === '' ) ).join( '\n' ).trim();
}

/** The inbox to send from: one Outreach already sends from, else any connected one. */
export function defaultSender ( inboxes: DocsInbox[] ): DocsInbox | null {
  const usable = inboxes.filter( ( i ) => i.status !== 'disconnected' );
  return usable.find( ( i ) => i.purposes.includes( 'outreach' ) ) || usable[0] || null;
}

/** TODD's "Why this address" note. */
export function whyThisAddress ( o: Pick<Opportunity, 'submission' | 'source'>, to: string ): string {
  const from = o.source.from;
  const rfpAddress = o.submission.email;
  if ( rfpAddress && to.toLowerCase() === rfpAddress.toLowerCase() ) {
    return from && isNoReply( from )
      ? `The alert came from ${ from }, which can't receive mail. The RFP says to send proposals to ${ rfpAddress }, so that's what I used.`
      : `The RFP says to send proposals to ${ rfpAddress }, so that's what I used.`;
  }
  if ( rfpAddress ) return `You changed this from ${ rfpAddress }, the address in the RFP. Make sure the RFP allows it.`;
  return 'The alert didn\'t say where to send proposals. Check the RFP\'s submission instructions and enter that address.';
}
