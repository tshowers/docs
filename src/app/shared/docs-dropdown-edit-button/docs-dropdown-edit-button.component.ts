import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { DocsAuthService } from '../../services/docs-auth.service';
import { DocsDropdownService } from '../../services/docs-dropdown.service';
import { DocsNotificationService } from '../../services/docs-notification.service';
import { Dropdown } from '../../models/dropdown.model';

/**
 * Trimmed replacement for taliferrotech's shared/page/drop-down-edit-button
 * component. The original opens a full DropdownManagerComponent (375
 * lines, a generic admin tool covering ~15 different dropdown collections
 * across all of TODD - projects, task status, product types, sectors...).
 * ResponseFlowComponent (the only consumer here) only ever edits
 * Knowledge Base categories, so this reimplements just that: a small
 * inline modal to add/remove entries in the one collection
 * DocsDropdownService knows about, keeping the same [dropdownKey]/
 * (updated) contract.
 */
@Component( {
  selector: 'app-docs-dropdown-edit-button',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docs-dropdown-edit-button.component.html',
  styleUrl: './docs-dropdown-edit-button.component.css'
} )
export class DocsDropdownEditButtonComponent implements OnInit, OnDestroy {
  @Input() dropdownKey!: string;
  @Output() updated = new EventEmitter<void>();

  showModal = false;
  isAuthenticated = false;
  items: Dropdown[] = [];
  newItemName = '';
  isSaving = false;

  private tenantId = '';
  private authSubscription!: Subscription;

  constructor (
    private authService: DocsAuthService,
    private dropdownService: DocsDropdownService,
    private notificationService: DocsNotificationService
  ) { }

  ngOnInit (): void {
    this.authSubscription = this.authService.getUser().subscribe( user => {
      this.isAuthenticated = !!user;
    } );
    this.authService.getTenantId().subscribe( tenantId => {
      this.tenantId = tenantId || '';
    } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  openModal ( event?: MouseEvent ): void {
    event?.stopPropagation();
    if ( !this.isAuthenticated ) {
      this.notificationService.show( 'Sign in required', 'You must be logged in to edit dropdown options.', 'info' );
      return;
    }
    if ( !this.dropdownKey ) return;

    this.showModal = true;
    this.loadItems();
  }

  closeModal ( event?: MouseEvent ): void {
    event?.stopPropagation();
    this.showModal = false;
    this.updated.emit();
  }

  onBackdropClick ( event: MouseEvent ): void {
    event.stopPropagation();
    this.closeModal();
  }

  onDialogClick ( event: MouseEvent ): void {
    event.stopPropagation();
  }

  private loadItems (): void {
    if ( !this.tenantId ) return;
    this.dropdownService.getItems( this.tenantId, this.dropdownKey ).then( items => {
      this.items = items;
    } );
  }

  addItem (): void {
    const name = this.newItemName.trim();
    if ( !name || !this.tenantId ) return;

    this.isSaving = true;
    this.dropdownService.addItem( this.tenantId, this.dropdownKey, name ).then( () => {
      this.newItemName = '';
      this.isSaving = false;
      this.loadItems();
    } ).catch( () => {
      this.isSaving = false;
      this.notificationService.show( 'Error', 'Unable to add option.', 'error' );
    } );
  }

  removeItem ( item: Dropdown ): void {
    if ( !this.tenantId ) return;

    this.dropdownService.removeItem( this.tenantId, this.dropdownKey, item.id ).then( () => {
      this.loadItems();
    } ).catch( () => {
      this.notificationService.show( 'Error', 'Unable to remove option.', 'error' );
    } );
  }
}
