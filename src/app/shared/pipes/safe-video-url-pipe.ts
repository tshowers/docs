import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/** Ported unchanged from taliferrotech's shared/pipes/safe-video-url-pipe.ts. */
@Pipe({
  name: 'safeVideoUrl',
  standalone: true
})
export class SafeVideoUrlPipe implements PipeTransform {

  constructor(private sanitizer: DomSanitizer) {}

  transform(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

}
