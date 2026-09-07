import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component( {
  selector: 'app-docs-ios-showcase',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './app-showcase.component.html',
  styleUrl: './app-showcase.component.css'
} )
export class AppShowcaseComponent {
  readonly highlights = [
    { heading: 'Find the right document before the conversation starts', copy: 'Search proposals, responses, templates, and knowledge from wherever the next conversation happens.' },
    { heading: 'Capture useful work while it is still fresh', copy: 'Add a document from your phone and keep the context attached instead of waiting until you are back at your desk.' },
    { heading: 'Bring your best language into the next opportunity', copy: 'TODD can surface the supporting material and prior answers that help you prepare with confidence.' }
  ];
}
