export interface CommandPaletteEntry {
  id: string;
  label: string;
  group: string;
  /** Internal route (starts with '/') or a full https:// URL to another app. */
  path: string;
  queryParams?: Record<string, string>;
  keywords: string[];
  /** Path to an icon image, relative to /assets. Omit for a label-only row. */
  icon?: string;
  /** True when `path` is a full URL to another app rather than an internal route. */
  external?: boolean;
  /** External entries only: open in a new tab instead of the current one. */
  newTab?: boolean;
}

export const COMMAND_PALETTE_ENTRIES: CommandPaletteEntry[] = [
  // --- Docs (this app) -----------------------------------------------------
  { id: 'home', label: 'Home', group: 'Docs', path: '/', keywords: ['home', 'landing', 'docs', 'docs home', 'dashboard'] },
  { id: 'ios-app', label: 'Docs for iOS', group: 'Docs', path: '/ios', keywords: ['ios', 'app', 'mobile', 'showcase'] },
  { id: 'docs-opportunities', label: 'Opportunities', group: 'Docs', path: '/opportunities', keywords: ['opportunities', 'rfps', 'rfp list', 'requests for proposal', 'proposals', 'proposal history', 'bids'] },
  { id: 'docs-rfp-inbox', label: 'RFP inbox', group: 'Docs', path: '/opportunities/inbox', keywords: ['rfp inbox', 'connect inbox', 'email alerts', 'opengov', 'bonfire'] },
  { id: 'docs-add-rfp', label: 'Add an RFP', group: 'Docs', path: '/upload', queryParams: { rfp: '1' }, keywords: ['upload rfp', 'new rfp', 'add rfp'] },
  { id: 'docs-documents', label: 'Documents', group: 'Docs', path: '/documents', keywords: ['documents', 'document vault', 'files', 'my documents'] },
  { id: 'docs-upload', label: 'Add files', group: 'Docs', path: '/upload', keywords: ['upload', 'add document', 'add files'] },
  { id: 'docs-editor', label: 'New document', group: 'Docs', path: '/new', keywords: ['editor', 'document studio', 'write', 'new document'] },
  { id: 'docs-pricing', label: 'Docs Pricing', group: 'Docs', path: '/docs/pricing', keywords: ['pricing', 'docs plans', 'billing'] },
  { id: 'knowledge-base', label: 'Knowledge Base', group: 'Docs', path: '/knowledge', keywords: ['knowledge base', 'knowledge', 'repository'] },
  { id: 'knowledge-response-flow', label: 'Knowledge Management', group: 'Docs', path: '/knowledge/response-flow', keywords: ['response flow', 'knowledge management', 'wizard'] },
  { id: 'knowledge-pricing', label: 'Knowledge Pricing', group: 'Docs', path: '/knowledge/pricing', keywords: ['knowledge pricing', 'plans', 'billing'] },
  { id: 'docs-help', label: 'Help', group: 'Docs', path: '/help', keywords: ['help', 'guide', 'how to', '16ahead', 'assistance'] },

  // --- Other Apps -----------------------------------------------------------
  { id: 'app-marketing-assistant', label: 'Marketing Assistant', group: 'Other Apps', path: 'https://marketing.16ahead.com', icon: 'assets/brand/products/png/light/03-marketing-assistant-64.png', external: true, keywords: ['marketing assistant', 'marketing director'] },
  { id: 'app-general-assistant', label: 'General Assistant', group: 'Other Apps', path: 'https://assistant.16ahead.com', icon: 'assets/brand/products/png/light/02-general-assistant-64.png', external: true, keywords: ['general assistant', 'assistant', 'chat'] },
  { id: 'app-signature', label: 'Email Signature Builder', group: 'Other Apps', path: 'https://signature.16ahead.com', icon: 'assets/brand/products/png/light/15-email-signature-64.png', external: true, keywords: ['email signature', 'signature builder'] },
  { id: 'app-image-creator', label: 'Image Creator', group: 'Other Apps', path: 'https://images.16ahead.com', icon: 'assets/brand/products/png/light/14-image-creator-64.png', external: true, keywords: ['image creator', 'images', 'generate image', 'logo', 'icon', 'banner'] },
  { id: 'app-email-creator', label: 'Email Creator', group: 'Other Apps', path: 'https://emails.16ahead.com', icon: 'assets/brand/products/png/light/13-email-creator-64.png', external: true, keywords: ['email creator', 'email design', 'newsletter', 'html email', 'template', 'announcement'] },
  { id: 'app-find', label: 'Find', group: 'Other Apps', path: 'https://find.16ahead.com', icon: 'assets/brand/products/png/light/11-find-64.png', external: true, keywords: ['find', 'ask a question'] },
  { id: 'app-lead-vault', label: 'Lead Vault', group: 'Other Apps', path: 'https://lead-vault.16ahead.com', icon: 'assets/brand/products/png/light/10-lead-vault-64.png', external: true, keywords: ['lead vault', 'leads', 'purchased leads'] },
  { id: 'app-moves', label: 'Moves', group: 'Other Apps', path: 'https://moves.16ahead.com', icon: 'assets/brand/products/png/light/06-moves-64.png', external: true, keywords: ['moves', 'tasks', 'projects', 'to-dos'] },
  { id: 'app-network', label: 'Network', group: 'Other Apps', path: 'https://network.16ahead.com', icon: 'assets/brand/products/png/light/04-network-64.png', external: true, keywords: ['network', 'contacts', 'crm', 'relationships'] },
  { id: 'app-outreach', label: 'Outreach', group: 'Other Apps', path: 'https://outreach.16ahead.com', icon: 'assets/brand/products/png/light/05-outreach-64.png', external: true, keywords: ['outreach', 'campaigns', 'sequences', 'email marketing'] },
  { id: 'app-pulse', label: 'Pulse', group: 'Other Apps', path: 'https://pulse.16ahead.com', icon: 'assets/brand/products/png/light/08-pulse-64.png', external: true, keywords: ['pulse', 'surveys', 'feedback', 'nps'] },
  { id: 'app-sayit', label: 'SayIt', group: 'Other Apps', path: 'https://sayit.16ahead.com', icon: 'assets/brand/products/png/light/12-sayit-64.png', external: true, keywords: ['sayit', 'say it'] },
  { id: 'app-social', label: 'Social', group: 'Other Apps', path: 'https://social.16ahead.com', icon: 'assets/brand/products/png/light/09-social-64.png', external: true, keywords: ['social', 'social media'] },
  { id: 'app-music', label: 'Taliferro Music', group: 'Other Apps', path: 'https://music.taliferro.com', icon: 'assets/find/entities/music/logo-bw-icon.png', external: true, newTab: true, keywords: ['music', 'stream music'] },
];
