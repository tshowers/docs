import { MenuAppConfig } from '@taliferro/ui/platform/universal-menu.model';

/** Docs' part of the universal menu: what you can do in Docs. */
export const PLATFORM_MENU_CONFIG: MenuAppConfig = {
  app: 'docs',
  name: 'Docs',
  items: [
    { label: 'Home', icon: 'home', route: '/docs' },
    { label: 'Opportunities', icon: 'list', route: '/opportunities', keywords: 'rfp rfps request for proposal proposals bids' },
    { label: 'Documents', icon: 'folder', route: '/documents', keywords: 'files vault' },
    { label: 'Knowledge', icon: 'book', route: '/knowledge', keywords: 'answers knowledge base' },
    { label: 'Add files', icon: 'upload', route: '/upload' },
    { label: 'New document', icon: 'pen', route: '/new', keywords: 'editor write studio' },
    { label: 'RFP inbox', icon: 'grid', route: '/opportunities/inbox', keywords: 'email alerts opengov bonfire' },
  ],
  secondaryItems: [
    { label: 'Profile', icon: 'user', route: '/profile' },
    { label: 'Help', icon: 'help', route: '/help' },
  ],
  signInRoute: '/get-started',
  profileRoute: '/profile',
};
