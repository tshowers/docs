import { Pipe, PipeTransform } from '@angular/core';

/** Ported unchanged from taliferrotech's shared/pipes/resource-why.pipe.ts. */
@Pipe({ name: 'resourceWhy', standalone: true, pure: true })
export class ResourceWhyPipe implements PipeTransform {
  transform(url?: string): string | null {
    if (!url) return null;
    let host = '';
    try { host = new URL(url).hostname.replace('www.', ''); } catch { return null; }
    switch (host) {
      case 'cdc.gov': return 'Authoritative U.S. public health guidance.';
      case 'nih.gov': return 'U.S. biomedical research and clinical resources.';
      case 'ginasthma.org': return 'Global asthma strategy and tools.';
      case 'uspreventiveservicestaskforce.org': return 'Evidence-based screening recommendations.';
      case 'mayoclinic.org': return 'Plain-language clinical overviews.';
      case 'cochranelibrary.com': return 'Systematic reviews and evidence syntheses.';
      case 'who.int': return 'Global health policy and advisories.';
      default: return null;
    }
  }
}
