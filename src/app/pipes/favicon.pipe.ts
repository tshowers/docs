import { Pipe, PipeTransform } from '@angular/core';

/** Ported unchanged from taliferrotech's shared/pipes/favicon.pipe.ts. */
@Pipe({ name: 'favicon', standalone: true, pure: true })
export class FaviconPipe implements PipeTransform {
  transform(url?: string): string {
    if (!url) return '';
    try {
      const host = new URL(url).hostname.replace('www.', '');
      return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
    } catch { return ''; }
  }
}
