/**
 * Trimmed from taliferrotech's shared/utils/module-install-config.util.ts -
 * only the 'docs' and 'knowledge' entries (this app's two products), same
 * as web-products/network's own trims of shared, multi-product config
 * files (purchase-flow.config.ts) down to just its own entry.
 */
export type ModuleInstallKey = 'docs' | 'knowledge';

export interface ModuleInstallConfig {
  key: ModuleInstallKey;
  moduleName: string;
  installLabel: string;
  marketingEntryPath: string;
  launchRoute: string;
  manifestPath: string;
  iconPath: string;
  themeColor: string;
  iosInstructionTitle: string;
  iosInstructionSteps: string[];
}

const MODULE_INSTALL_CONFIGS: Record<ModuleInstallKey, ModuleInstallConfig> = {
  docs: {
    key: 'docs',
    moduleName: 'Docs',
    installLabel: 'Install Docs',
    marketingEntryPath: '/docs',
    launchRoute: '/docs',
    manifestPath: '/manifest.webmanifest',
    iconPath: '/assets/docs/docs.png',
    themeColor: '#0b0b0f',
    iosInstructionTitle: 'Install Docs on your iPhone or iPad',
    iosInstructionSteps: [
      'Open this page in Safari.',
      'Tap the Share button at the bottom of the screen.',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add to install Docs.'
    ]
  },
  knowledge: {
    key: 'knowledge',
    moduleName: 'Knowledge Base',
    installLabel: 'Install Knowledge',
    marketingEntryPath: '/knowledge',
    launchRoute: '/knowledge',
    manifestPath: '/manifest.webmanifest',
    iconPath: '/assets/knowledge/knowledge.png',
    themeColor: '#0b0b0f',
    iosInstructionTitle: 'Install Knowledge on your iPhone or iPad',
    iosInstructionSteps: [
      'Open this page in Safari.',
      'Tap the Share button at the bottom of the screen.',
      'Scroll down and tap Add to Home Screen.',
      'Tap Add to install Knowledge.'
    ]
  }
};

export function getModuleInstallConfig ( key: ModuleInstallKey | string | null | undefined ): ModuleInstallConfig | null {
  if ( !key ) {
    return null;
  }

  const normalizedKey = String( key ).trim().toLowerCase() as ModuleInstallKey;
  return MODULE_INSTALL_CONFIGS[normalizedKey] || null;
}
