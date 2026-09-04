import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DocsDropdownService } from '../../services/docs-dropdown.service';
import { Dropdown } from '../../models/dropdown.model';
import { LoggerService } from '../../services/logger.service';
import { DocsAuthService } from '../../services/docs-auth.service';

/**
 * Trimmed replacement for taliferrotech's shared/page/input-type-ahead
 * component. The original reads via TODD's full DataService against any
 * of ~30 ENDPOINTS collections; ResponseFlowComponent (the only consumer
 * in this app) only ever passes `collectionName="KNOWLEDGE_BASE_CATEGORIES"`,
 * so this keeps the same [collectionName]/[isMultiSelect]/
 * [preselectedSingleValue]/[preselectedMultiValue]/[placeholder]/
 * (selectionChange) contract but reads through DocsDropdownService
 * instead. Debounced filtering is simplified to a synchronous in-memory
 * filter (the dataset - Knowledge Base categories - is small).
 */
@Component( {
  selector: 'app-docs-input-type-ahead',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './docs-input-type-ahead.component.html',
  styleUrl: './docs-input-type-ahead.component.css'
} )
export class DocsInputTypeAheadComponent implements OnInit, OnDestroy {

  @Input() collectionName!: string;
  @Input() isMultiSelect: boolean = false;
  @Input() preselectedSingleValue?: string;
  @Input() preselectedMultiValue: any[] | undefined;
  @Input() showSelected: boolean = true;
  @Input() placeholder: string = 'Search...';

  @Output() selectionChange = new EventEmitter<any | any[]>();

  inputText: string = '';
  filteredItems: Dropdown[] = [];
  selectedItems: any[] = [];

  private allItems: Dropdown[] = [];
  private tenantId = '';
  private authSubscription!: Subscription;

  constructor (
    private authService: DocsAuthService,
    private dropdownService: DocsDropdownService,
    private logger: LoggerService
  ) { }

  ngOnInit (): void {
    this.authSubscription = this.authService.getTenantId().subscribe( tenantId => {
      this.tenantId = tenantId || '';
      this.onCollectionInit();
      this.initSelectedItems();
    } );
  }

  ngOnDestroy (): void {
    this.authSubscription?.unsubscribe();
  }

  onCollectionInit (): void {
    if ( !this.collectionName || !this.tenantId ) return;

    this.dropdownService.getItems( this.tenantId, this.collectionName )
      .then( items => {
        this.allItems = items || [];
        this.filteredItems = this.allItems;
        if ( !this.isMultiSelect && this.preselectedSingleValue ) {
          this.inputText = this.preselectedSingleValue;
        }
      } )
      .catch( error => {
        this.logger.error( 'Error fetching items:', error );
        this.allItems = [];
      } );
  }

  initSelectedItems () {
    if ( this.isMultiSelect ) {
      if ( this.preselectedMultiValue && this.preselectedMultiValue.length > 0 ) {
        this.preselectedMultiValue.forEach( element => {
          this.selectedItems.push( element );
        } );
      }
    } else {
      if ( this.preselectedSingleValue )
        this.selectedItems = [this.preselectedSingleValue];
    }
  }

  onInputChange ( value: string ): void {
    this.inputText = value;
    const filterValue = value.toLowerCase();
    this.filteredItems = this.allItems.filter( item => item.name?.toLowerCase().includes( filterValue ) );
  }

  selectItem ( item: Dropdown ): void {
    if ( this.isMultiSelect ) {
      if ( !this.selectedItems.find( selected => selected.id === item.id ) ) {
        this.selectedItems.push( item );
        this.selectionChange.emit( this.selectedItems );
      }
    } else {
      this.selectedItems = [item];
      this.selectionChange.emit( item );
    }

    this.inputText = '';
    this.filteredItems = this.allItems;
  }

  removeMultiItem ( index: number ) {
    if ( this.preselectedMultiValue )
      this.preselectedMultiValue.splice( index, 1 );
  }
}
