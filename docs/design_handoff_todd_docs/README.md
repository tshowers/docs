# Handoff: TODD Docs redesign

## Overview
A redesign of TODD Docs (`tshowers/docs`, Angular 19 standalone + Firebase) in the Find look. The ten separate pages collapse into four tabs (**Home, Opportunities, Documents, Knowledge**). TODD reads incoming RFPs, scores them against the user's profile, drafts the proposal, checks it against the RFP's rules and sends it. While drafting, TODD asks for anything it doesn't know and saves each answer to Knowledge. That replaces the Response Flow wizard as the main way knowledge gets captured.

**Who's who:** TODD is the assistant everywhere in Docs. It reads, drafts, files and asks. Maya (the AI marketing director) appears only when something is handed off to become a post ("Send to Maya for a post").

## Kickoff prompt for Claude Code
> Read this README and open `TODD Docs Redesign.dc.html` in a browser (keep `Docs Header.dc.html`, `support.js`, `public/` and `src/` beside it). Implement in `tshowers/docs` using its existing Angular components, services and data model (DocumentListComponent, RepositoryComponent, response-flow API, RFP and proposal-history services). Build: the header, Home (1b = 2a signed out), Opportunities (1a list, 1d detail), the proposal editor (1e), review & send (1f), Documents (1h), Knowledge (1g), single-item views (2d–2g), upload (1i), New (1j), About (2b), Help (2c), and the iPad/iPhone layouts (1k–1m, 2h–2i). Match the screenshots pixel for pixel. Don't duplicate business logic that already exists.

## About the design files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behavior, not production code to copy. Recreate them in the existing Angular app using its established patterns. `.dc.html` files open directly in a browser; `support.js` is the runtime that renders them.

## Fidelity
**High-fidelity.** Final colors, type, spacing, radii and layout. Organizations, RFP numbers, dollar values, names (Dana Reyes, Mara Lin), file names and the forwarding address `rfp@taliferro.todd.docs` are placeholders. The grey "image preview" and "PDF page 1 preview" boxes are placeholders for real thumbnails.

## Decisions
| Area | Before | Now |
|---|---|---|
| Home | Docs cockpit with health meters | **1b**: one ask/search box, quick actions, "N RFPs fit you" and "Needs you". 1a and 1c were the alternatives and were not chosen. |
| Signed out | Browse-mode banner per page | **2a**: Home + yellow banner. The box answers from a sample workspace; nothing is saved. Header shows Home / About / Help + Sign in. |
| RFP list, RFP upload, Proposal History | 3 pages | **Opportunities**: RFPs and the proposals made from them live together. |
| Response Flow | Step-by-step wizard | TODD's questions inside the editor (1e). Question, response, resource and keywords are still saved; TODD fills in resource, keywords and category. "Add knowledge" from New still exists. |
| Knowledge Base | Horizontal card scroller | **Knowledge** grid (1g) + single-answer view (2d) |
| Document vault, Add Document | 2 pages | **Documents** grid (1h) + upload (1i) |
| Document Editor / Studio | Separate page | Every document opens in it; **New** (1j) is the way in |
| Pricing, Help, Profile, About | Header/menu links | Universal **Menu** (About and Help also in the signed-out header) |
| Submission | — | Email to the address the RFP specifies (never the no-reply sender), or a package download for portal-only RFPs (Bonfire) |

## Screens

All desktop frames are 1280 wide; content columns have a max width and center. Screenshots are at 0.72× (924px wide); phone screenshots are at 1×.

### Header (`Docs Header.dc.html`) — every screen
- **Desktop:** padding 20/40. Left (flex 1): `todd-docs-icon.png` 34×34 radius 10 + "TODD" + "Docs" (22/700, -0.02em; "Docs" `--muted`). Center: tabs Home / Opportunities / Documents / Knowledge (14/600, pill padding 8×14, active `--surface`). Opportunities carries a count badge (20px `--blue` pill, 11/700 white). Right (flex 1, end, gap 8): **New** (42px `--blue` pill, plus 16 + label, 700) → **Light/Dark** (42px `--surface` pill, moon/sun 16 + label of the mode you'd switch to) → **Menu** (42px `--text` pill, `--bg` text, menu icon 18).
- **Signed out (`mode="out"`):** tabs become Home / About / Help; New becomes **Sign in** (blue pill).
- **Tablet:** padding 20/28, brand 20px, New and theme become 44px circles.
- **Phone:** padding 56/16/10, icon 32 + page title 18/700, 44px theme circle, Menu pill. Tabs move to a bottom bar (Home, Opportunities, Documents, Knowledge; 22px icons, 11px labels, active `--blue-ink` 700).

### Home
- **1b Home** (`1b-home-find-style.png`): column max 880, padding 56/40, centered. Icon 72 radius 20 → headline "What do you need to write, find or answer?" 48/700 -0.04em → ask box (64px pill `--surface`, search 22 muted, placeholder 18 muted, **Go** 48px blue pill) → quick pills (44px, tinted: Answer an RFP violet, Find a document blue, Add files green, Ask Knowledge cyan; icon 16 + label 15/700). Below, max 1120, a 2-column grid of `--surface` radius 28 cards: **3 RFPs fit you** (rows: 44px match circle tinted by score + title 15/700 ellipsis + "org · due date" 13 muted + chevron) and **Needs you** (40px tinted icon circle + text 15/600 + action 13/700 `--blue-ink`).
- **2a Home, signed out** (`2a-home-signed-out.png`): header `mode="out"`. Banner under the header (max 1120): pill `--t-yellow`, alert icon, "**You're not signed in.** Look around as much as you like. To use Docs with your own files, sign in. Nothing you do here is saved." + **Sign in** (blue) + **Get started** (`--bg`). Hero as 1b with placeholder "Try it: search a sample workspace or ask a question…". Then 3 cards (`--surface` r28, 48px tinted icon circle, 20/700 title, 15 muted body; copy from help `differences`) and two `--surface` pills: "What is Docs? →" (About), "How to use it →" (Help).
- 1a and 1c (`1a-…`, `1c-…`): alternatives that weren't chosen. They're included because their parts are reused: the 1a RFP card (match ring, why/gap lines, Draft proposal) and the 1c needs-attention rows.

### Opportunities
- **1d Opportunity** (`1d-opportunity.png`): grid `1fr 360px`, gap 40. Left: back pill; RFP tag (violet) + source line; title 48/700; summary 18 muted; 4 fact tiles (Due, Value, Page limit, Submit by; `--surface` r20); "What they'll score you on" rows (pill, points 56px chip, criterion, status tag green "Ready from Knowledge" / blue "TODD will ask you"). Right (sticky): fit card `--t-green` r28 with 64px score circle + check lines; "Before I draft" card with **Draft proposal** (48px blue) and Read the RFP / Not for us.
- Match score tints: ≥85 green, 75–84 blue, below 75 yellow. Gap lines use `--t-pink-fg` with an alert icon.
- **1e Proposal editor** (`1e-proposal-editor.png`): title row (back circle, title 20/700, "org · due · saved just now", **Review & send**). Grid `220px 1fr 340px`, gap 24. Left: section list (10px status dot: done `--t-green-fg`, waiting on you `--blue`, current `--text`, not started `--surface2`; current row `--surface`). Center: `--surface` r28 wrapping a `--bg` r20 page (padding 44/52). Text pulled from Knowledge sits in a `--t-blue` r18 block labelled "FROM KNOWLEDGE · {answer title}". A section waiting on the user is a `--t-yellow` block. Right: **TODD question card** (`--t-blue` r28): "TODD · question n of m", question 16/700, answer field (`--bg` r20), checkbox "Save to Knowledge for next time" (checked by default), **Use this answer** / Skip. **RFP checklist** (`--surface` r28): rows with 24px status circles (green check / pink x), title 14/600, detail 13 muted, count "4 of 6".
- **1f Review & send** (`1f-review-and-send.png`): grid `1fr 380px`. Left: headline; mail card (To, Subject, From rows on `--bg` r20; To shows "From RFP section 4.2"); message body; attachment chips (36px tinted type circle + name + pages). **Send proposal** (52px blue) + **Download package**. Right: checklist summary (`--t-green`), "Why this address" (TODD explains that no-reply senders can't receive mail), "When it's portal-only" note.

### Documents and Knowledge
- **1h Documents** (`1h-documents.png`): Find's All grid. Search pill 52px + Add files. Filter pills 38px (active `--text` fill) with counts; "**8 found** for {q}". Grid 4 columns, gap 18. Card: `--surface` r20, overflow hidden. Top is the image (16:10), a video tile (`#15171d`, 52px play circle, duration), or a **tinted type plate** (16:10, tint by kind: RFP violet, Proposal blue, Contract cyan, Pricing green, Compliance yellow, Media pink; kind 13/700 + extension 30/700). Body: folder icon + folder + date (12 muted), title 16/700 clamp 2 with the search term highlighted (`--hl` red 700, or marker style), summary 14 muted clamp 2, optional yellow flag ("Expires Nov 30").
- **1g Knowledge** (`1g-knowledge.png`): search pill; TODD card (`--t-blue` r24); grid 3 columns of answer cards (`--surface` r24, padding 22): optional tag (New / Still true?), question 18/700 with highlight, answer 14 muted clamp 3, "Used in N proposals · freshness".
- **1i Upload** (`1i-upload.png`): column max 1000. Dashed drop zone (96px, r28). Rows: grid `52px 1fr auto` (`--surface` r24): 52px tinted type circle, original filename 13 muted, TODD's name 16/700, TODD's note 14, folder chip on the right. A row that needs the user is `--t-pink`, with choice pills (W-9 / Signed form / Something else). If an upload is an RFP, it goes to Opportunities and gets scored.
- **1j New** (`1j-new-document.png`): "What are you writing?" + 64px input with **Start**. Card "I'll write a 2-page capability statement from" + source chips (tinted, checked). "Or start from" grid of 4 tinted tiles: Answer an RFP, Cover letter, Edit a Word file, Blank document.

### Single item views (2d–2g)
Shared top bar (Find's result nav): `--surface` pill, grid `1fr auto 1fr`: back (38px `--bg` circle + "Back / To {n} {results}"), center "**i of n**", right prev/next 38px circles. Content grid `1fr 340–380px`, gap 36–40.
- **2d Knowledge answer** (`2d-knowledge-answer.png`): maps to `RepositoryComponent` fields. Tags: category (cyan), "Confirmed {date}" (green). Question 44/700. **Evidence summary**: numbered answers (`--surface` r24, 40px number circle, text 18) with a source chip (domain or document), the URL/type, and **Copy citation** / **Open**. **Recommendations**: pill rows, type tag (Practice green, Policy violet, Resource cyan) + text + optional link. **Resources**: 32px initial circle + domain 15/700 + why 13 muted. **Keywords**: `--surface` chips. Right: **Edit** (blue) · **Send to Maya for a post** · More; "Used in N proposals" list (status tags Draft yellow, Submitted blue, Won green, Lost pink); "Where this came from" (`--t-blue`): which draft prompted the question, when it was confirmed, when TODD will ask again. Show the via Find and Draft badges from the repository as extra tags when present.
- **2e Document** (`2e-document.png`): left `--surface` r28 with page preview (8.5:11) + pager ("Page 1 of 18"). Right: 64×80 tinted type plate + title 26/700 + "PDF · Proposal · 18 pages"; actions Open (blue) · Edit · Share · Post · More (44px); metadata list (`--surface` r24, `96px 1fr`: Topic, Author, Updated, Outcome, Folder, File); TODD summary (`--t-blue`); **Connected to** chips (RFP, Deal, Contact, Knowledge answers). Same layout for Word, Excel and PowerPoint.
- **2f Image** (`2f-image.png`): 16:10 image r28 + 4 thumbnails (selected has a 3px `--blue` ring). Right: title, "Image · Design · 4 images", posting status tag ("Posted to LinkedIn · Oct 9", via existing `postedStatusLabel()`), actions, metadata, **Alt text** card written by TODD with Edit.
- **2g Video** (`2g-video.png`): 16:9 dark player r28, 88px play circle, duration. It never autoplays (reuse `openVideoLightbox()` or play inline on press). Transcript rows (timestamp 13/700 `--blue-ink` + line); timestamps seek. Right: Play (blue) · Share · Post a clip · More; metadata; TODD summary.

### About and Help (signed-out header)
- **2b About** (`2b-about.png`): Find's About layout. Copy is verbatim from `landing.component.{html,ts}`: hero, the problem band (`--text` fill, 3 items), "What Docs gives you" (4 outcome cards with tinted tags), "How Docs works" (`--t-blue` band, 3 numbered steps), FAQ (accordion, first open), closing CTA (Get started / Read Docs Help / Pricing).
- **2c Help** (`2c-help.png`): Find's Help layout: hero (copy verbatim from `help.component.html`), sticky left step nav (260px) + step cards (56px tinted number circle, title 24/700, copy 16, bullet details, action pill). **The six steps are rewritten for the new tabs** (the old ones point at pages that no longer exist). FAQ is verbatim from `help.component.ts`, laid out as a 2-column card grid. Keep the existing signed-in "Your progress" checklist above the steps.

### iPad and iPhone
- **1k iPad** (1180×820, `1k-ipad-documents.png`): follows `docs/Rework the iPad document-list experience.md`. Library 400px (search + rows: 52×64 tinted type plate + title clamp 2 + "kind · folder · date"; selected row `--surface`). Inspector: `--surface` with radius 28 at the top left only; type plate, title, actions (Draft proposal for RFPs, Open, Share, More), TODD's read, facts.
- **1l iPhone Home**, **1m iPhone opportunity** (sticky Draft proposal 52px + Not for us), **2h iPhone knowledge answer** (sticky Edit + Send to Maya for a post), **2i iPhone document** (sticky Open + Edit/Share circles). Hit targets ≥ 44px.

## Interactions & behavior
- Home box: TODD routes the input. Search terms → Documents/Knowledge results; a question → an answer from Knowledge; an RFP link or file → Opportunities. Signed out, it answers from a sample workspace.
- RFP intake: forwarded alert emails (OpenGov, King County, Bonfire) and manual upload both create an opportunity. TODD scores it against the TODD profile and lists why it fits and what's missing.
- Draft proposal → editor. TODD asks one question at a time. "Use this answer" fills the section; if Save to Knowledge is checked, it also creates a knowledge item (question, answer, keywords and category filled in by TODD; the source proposal is recorded).
- Checklist items update live. **Review & send** is always available, but **Send** is disabled until the checklist is complete.
- Send uses the submission address parsed from the RFP. If the RFP is portal-only, the primary action becomes **Download package** plus a link to the portal; the proposal is marked submitted when the portal's confirmation email arrives.
- Cards and rows: hover `--surface2` (on `--surface`) or brightness 0.94–0.97 (on blue/tinted). Focus: 2px `--blue` outline, offset 2.
- Single item views: prev/next move through the current result set; Back returns to the same scroll position.
- Light/Dark: the header toggle and `prefers-color-scheme`.

## State
- `session` (signed in / guest), `theme`.
- `opportunities[]` (source, sender, title, due, value, match score, reasons, gaps, criteria, submission method/address, status).
- `proposal` (sections + status, pending TODD questions, checklist items, attachments).
- `documents[]` (existing Document model + kind/folder from auto-organize, flags), `knowledge[]` (existing response-flow model + usedIn[], confirmedAt, origin).
- `uploads[]` (file, TODD name, folder, note, needsChoice options).

## Design tokens (Find)
Light: `--bg #fff`, `--surface #f2f3f6`, `--surface2 #e4e7ed`, `--canvas #d9dce3`, `--text #0f1115`, `--muted #5a6170`, `--blue #2f6bff`, `--blue-ink #1f55e0`, `--hl #d0021b`. Tints (bg / fg): blue `#e3ecff/#1d4fd6`, cyan `#daf6fc/#08657d`, pink `#ffe3f1/#a8105a`, violet `#efe5ff/#6427c9`, yellow `#fff4c2/#6e5700`, green `#e0f6e6/#17703a`. Shadow `0 20px 50px rgba(15,17,21,.12)`.
Dark: `--bg #0c0e13`, `--surface #171a22`, `--surface2 #242936`, `--text #f2f4f8`, `--muted #9aa2b2`, `--blue #3d7bff`, `--blue-ink #86aeff`, `--hl #ff5a5f`; tints blue `#15254a/#a3c1ff`, cyan `#0c2d35/#74e4f8`, pink `#3a1029/#ff92c9`, violet `#2a1847/#cdaaff`, yellow `#2f2906/#ffe56a`, green `#0e2c19/#80e2a4`.
Type: "Helvetica Neue", Helvetica, Arial. Display 60/52/48/44 at 700, -0.04em, line-height 1–1.05. Section titles 34/30/26/24 at 700, -0.02 to -0.03em. Body 15–18, line-height 1.5–1.7. Kickers 12–13/700 uppercase, letter-spacing .06–.08em.
Radii: pills 999px; cards 20/24/28; small blocks 18; phone frame 48; iPad 36.
Spacing: frame padding 40; card padding 18–28; grid gaps 10–20; section gaps 22–32.
Icons: Lucide, stroke-width 2.75, round caps/joins; 13/16/18/22px.

## Assets
- `public/assets/todd-docs-icon.png`: from `tshowers/docs` (app icon/brand mark).
- `src/assets/avatar-todd-sm.png`: from `tshowers/docs` (TODD's avatar on question, summary and read cards).
- Icons are Lucide, inlined.

## Files
- `TODD Docs Redesign.dc.html`: every frame (round 2 at the top: 2a–2i; round 1 below: 1a–1m). Tweaks: theme (auto/light/dark), highlight (red/marker).
- `Docs Header.dc.html`: the header (props: active, mode app/out, size desk/tab/phone, dark).
- `support.js`: runtime for the `.dc.html` files.
- `screenshots/`: one PNG per frame, light mode.
