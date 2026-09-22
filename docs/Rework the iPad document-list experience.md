Rework the iPad document-list experience so it feels like a native iPad document workspace rather than a responsive version of the existing desktop carousel.

Use the existing `DocumentListComponent` as the source of truth for the data, document types, filtering, selection, editing, navigation, and existing document actions. Do not remove existing functionality.

## 1. Overall iPad layout

Create a two-column iPad layout.

### Left side: Document Library

Use approximately 32–36% of the available width.

At the top:

- Page title: `Documents`
- Document count
- Search field
- A compact filter/sort control
- View control if appropriate

Below that, display the user's documents in a vertically scrolling list.

Each item should be a compact document row/card.

The left library should remain visible while a document is selected.

### Right side: Document Preview / Detail

Use the remaining 64–68% of the screen.

When no document is selected:

- Show a quiet empty state.
- Use a large document icon.
- Text: `Select a document`
- Secondary text explaining that selecting a document will show its details.

When a document is selected:

- Show a large preview appropriate to its type.
- Show document metadata.
- Show available actions.
- Keep the interface uncluttered.

The right side should feel like a native iPad detail pane.

Do not recreate the current desktop "desk" experience on iPad.

The iPad experience should be cleaner and more intentional.

---

## 2. Document library cards

Create a reusable document-card component or equivalent template logic.

Every document card should have:

- Title
- Type
- Last modified/created information when available
- Author when available
- Topic when available
- Status information when available
- Social posting status when available
- Small action affordance

The metadata hierarchy should change based on document type.

---

# IMAGE DOCUMENTS

For images, make the image the dominant element.

Use a card approximately 100–130px tall depending on available width.

Structure:

┌─────────────────────────────┐
│ │
│ IMAGE │
│ │
├─────────────────────────────┤
│ Document title │
│ Image · Topic │
│ Mar 18 · Author │
└─────────────────────────────┘

The image should:

- Fill the upper portion of the card.
- Use `object-fit: cover`.
- Have rounded corners consistent with the native iPad design language.
- Never distort the image.
- Show a subtle placeholder if the image cannot load.

Do not overlay lots of text on the image.

The metadata belongs below the image.

If `lastPostedAt` exists, display the posting status subtly beneath the title.

For example:

`Posted to LinkedIn · Mar 18`

Use the existing `postedStatusLabel()` and `postedPlatformIcon()` methods where appropriate.

---

# VIDEO DOCUMENTS

Treat videos similarly to images, but make it obvious that the item is playable.

Structure:

┌─────────────────────────────┐
│ │
│ VIDEO THUMBNAIL │
│ ▶ │
│ │
├─────────────────────────────┤
│ Video title │
│ Video · Topic │
│ Mar 18 · Author │
└─────────────────────────────┘

Use the document's available video source.

If an actual thumbnail is unavailable, display a dark video placeholder with:

- Large play icon
- Video icon
- Optional duration if available

Do not automatically play videos inside the document library.

Playing a video should happen only after the user explicitly selects it.

Reuse the existing `openVideoLightbox()` behavior where appropriate.

---

# PDF / OFFICE / TEXT DOCUMENTS

Documents should NOT attempt to fake a thumbnail.

Instead, make the document type visually obvious.

Example:

┌─────────────────────────────┐
│ │
│ PDF │
│ │
│ fa-file-pdf icon │
│ │
├─────────────────────────────┤
│ RFP Response Draft │
│ PDF │
│ │
│ Topic: Government │
│ Author: Tyrone Showers │
│ Updated: Mar 18, 2026 │
│ │
│ Posted: LinkedIn · Mar 18 │
└─────────────────────────────┘

The document-type icon should be large and centered.

Use the existing `getDocumentTypeLabel()` logic.

Create a mapping for common types:

- PDF → `fa-file-pdf`
- DOC/DOCX → `fa-file-word`
- XLS/XLSX → `fa-file-excel`
- PPT/PPTX → `fa-file-powerpoint`
- Text → `fa-file-lines`
- Audio → `fa-file-audio`
- Video → `fa-file-video`
- Image → `fa-file-image`
- Unknown → `fa-file`

Do not use colored backgrounds for every file type.

Keep the design monochromatic and Apple-like.

---

# 3. Metadata hierarchy

Metadata is especially important for non-image documents.

For document cards, prioritize:

1. Title
2. Document type
3. Topic
4. Author
5. Updated/created date
6. Posting status
7. Description/summary where space permits

Do not show every available field by default.

The goal is "heavy metadata" without making the card look like a database record.

Use typography hierarchy rather than boxes and borders to separate metadata.

For example:

Title
`RFP Response — King County`

Secondary:
`PDF · Proposal`

Metadata:
`Government · Tyrone Showers · Mar 18, 2026`

Status:
`Posted to LinkedIn · Mar 18`

---

# 4. Selected document behavior

When the user taps a document:

- Mark it selected in the library.
- Update the right-hand detail pane.
- Do not navigate away from the document list unless the user explicitly chooses an action requiring navigation.

The selected document should have a subtle visual treatment.

Do not use a giant blue border.

Use:

- Slightly different background
- Small accent indicator
- Increased contrast
- Optional subtle shadow

The selection should feel like Apple's sidebar selection behavior.

---

# 5. Detail pane

The right side should provide a larger version of the selected document.

For an image:

- Large image centered in the available preview area.
- Image should preserve aspect ratio.
- Metadata underneath or beside the preview.

For a video:

- Large video thumbnail.
- Large play button.
- Metadata beneath it.

For a PDF:

- Display the PDF in the preview area if practical.
- Otherwise display the large PDF icon and document metadata.
- Include an obvious `Open` action.

For DOC/DOCX/PPT/XLS/etc.:

- Large document icon.
- Document title.
- Type.
- Summary/description.
- Topic.
- Author.
- Dates.
- Social posting status.
- Actions.

The detail pane should feel like a document inspector.

---

# 6. Detail actions

Use a compact action bar near the document title.

Possible actions:

- Open
- Edit
- Share
- Delete
- Post
- More

Do not display every action as a large button.

Use SF Symbols-style visual treatment if the iPad application framework supports it.

If this is being implemented with the existing web technology, use the existing Font Awesome icons but keep them visually restrained.

Reuse existing functionality:

- `startEditDocument()`
- `onDelete()`
- `onView()`
- `selectDocument()`
- existing editor navigation
- existing social/posting information

Do not duplicate business logic.

---

# 7. Search

Search should remain prominent at the top of the library.

Reuse the existing filtering behavior from:

`filteredDocuments`

and:

`onSearchDocuments()`

The search should search:

- title
- topic
- type
- author
- summary
- description

Do not introduce a second search implementation.

---

# 8. Empty states

If there are no documents:

Display:

`Your documents will appear here.`

with a prominent `Add Document` action.

Reuse the existing `/docs/upload` route.

If search produces no results:

Display:

`No documents found`

and:

`Try a different search.`

Do not display a completely empty white screen.

---

# 9. Responsive behavior

This design is specifically for iPad.

Use a breakpoint appropriate for the iPad experience.

Landscape should use the two-pane layout.

Portrait may transition into:

- document library first
- detail view after selection

Do not simply shrink the desktop layout.

The current desktop `desk` and `pins` functionality should remain intact.

This new iPad presentation should be an additional presentation layer.

---

# 10. Visual language

The visual design should feel like an Apple document application.

Use:

- generous whitespace
- large touch targets
- restrained borders
- subtle shadows
- rounded cards
- strong typography
- minimal chrome
- monochromatic icons
- clear hierarchy

Avoid:

- dashboard-looking cards
- excessive colored badges
- tiny text
- dense tables
- excessive borders
- gradients
- desktop-style toolbars
- floating controls everywhere

The interface should feel calm.

The content should be the interface.

---

# 11. Touch interaction

All interactive elements must be comfortable for touch.

Minimum touch target:

44px × 44px.

Do not require hover states.

Do not rely on right-click.

Document cards should respond naturally to tap.

Long press may expose additional actions if the existing application architecture supports it, but do not make long press necessary for normal functionality.

---

# 12. Document card sizing

For the iPad library, prefer approximately:

- 110–140px card height for image/video cards
- 130–170px for document cards because they contain more metadata
- 12–16px internal padding
- 12px spacing between cards

Do not make every card the same height if doing so causes unnecessary empty space.

The document type should determine the card composition.

---

# 13. Important architectural requirement

Do not rewrite the existing DocumentListComponent business logic.

Separate presentation from behavior where possible.

The existing component already contains important functionality including:

- document loading
- tenant handling
- filtering
- editing
- deletion
- selection
- document type detection
- video handling
- desk layout persistence
- posting status
- navigation

Reuse these methods.

The iPad UI should consume this existing state rather than creating a parallel document model.

If a new reusable component is needed, pass the existing `Document` object into it.

---

# 14. The core design principle

The final iPad experience should answer three questions immediately:

1. What is this?
2. What is it about?
3. What can I do with it?

For images and videos:

VISUAL FIRST → METADATA SECOND

For documents:

TYPE FIRST → METADATA FIRST → ACTIONS SECOND

Do not make the user open a document just to discover its basic identity.

The library should already tell them enough to decide what deserves attention.

---

# 15. Overall visual hierarchy

Think of the screen as:

DOCUMENTS SELECTED DOCUMENT
───────────────────── ─────────────────────────────

Search [Document Preview]

[Image] RFP Response — King County
Campaign Graphic PDF · Proposal
Image · Marketing Government
Mar 18 Tyrone Showers
Updated Mar 18, 2026

[PDF icon] Description...
RFP Response ...
PDF · Proposal
Government ────────────────────────────
Tyrone Showers [Open] [Edit] [Share] [More]
Updated Mar 18

[Video]
Product Demo
Video · Product
Mar 17

The library is the navigator.

The detail pane is the workspace.

The document itself is the focus.

That is the experience to build.
