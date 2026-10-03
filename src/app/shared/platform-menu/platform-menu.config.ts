import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Docs' part of the universal menu: what you can do in Docs. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'docs',
  name: 'Docs',
  logo: 'assets/find/entities/docs/logo.png',
  items: [
    { label: 'Home', icon: 'home', route: '/' },
    { label: 'Docs Home', icon: 'grid', route: '/docs' },
    { label: 'My Documents', icon: 'folder', route: '/docs/documents', keywords: 'files' },
    { label: 'Upload', icon: 'upload', route: '/docs/upload' },
    { label: 'Studio', icon: 'pen', route: '/docs/editor', keywords: 'editor write' },
    { label: 'Proposals', icon: 'file', route: '/docs/proposal-history' },
    { label: 'RFPs', icon: 'list', route: '/docs/rfp-list', keywords: 'request for proposal' },
    { label: 'Knowledge Base', icon: 'book', route: '/knowledge' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Help', icon: 'help', route: '/help' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
