import { Pipe, PipeTransform } from '@angular/core';

/** Ported unchanged from taliferrotech's shared/pipes/domain.pipe.ts. */
@Pipe({ name: 'domain', standalone: true, pure: true })
export class DomainPipe implements PipeTransform {
  transform(url?: string): string {
    if (!url) return '';
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  }
}
