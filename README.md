<p align="center">
  <img src="public/assets/docs.png" alt="TODD Docs" width="100%">
</p>

# TODD Docs

TODD Docs is the document and knowledge workspace for Taliferro Tech. It is intended to keep proposals, RFPs, response flows, reusable answers, and supporting files close to the work they support so TODD can help find and reuse them later.

The app is an Angular 19 standalone application backed by Firebase Authentication and the Taliferro Tech API. It is configured for Firebase Hosting as the `todd-docs` site.

## What it does

The current app provides these surfaces:

- **Docs cockpit** (`/docs`) — an overview of document health, capture readiness, proposal reuse, and knowledge freshness.
- **Documents** (`/docs/documents`) — a document vault with search, carousel, desk, and pins views, plus document editing and deletion for signed-in users.
- **Add Document** (`/docs/upload`) — upload PDFs, images, video, audio, Word files, and other references with descriptive metadata.
- **Document Editor** (`/docs/editor`) — create and edit document drafts, work with `.docx` files, and export content.
- **Knowledge Base** (`/knowledge`) — browse reusable question-and-answer entries and supporting evidence.
- **Response Flow** (`/knowledge/response-flow`) — a wizard for building a reusable answer through question, response, resource, and keyword steps.
- **Proposal History** (`/docs/proposal-history`) — review uploaded RFPs and proposals generated from them.
- **RFP tools** (`/docs/rfp-upload`, `/docs/rfp-list`) — upload and browse RFP records.
- **Pricing and success pages** for Docs and Knowledge subscriptions.
- **Landing and iOS preview pages** (`/`, `/ios`) for product introduction and future mobile positioning.

## Guest mode

Most product surfaces are intentionally explorable without signing in. Guests see the layout and an honest preview, but live private values and write actions remain disabled. The browse-mode banner sends users to the hosted TODD sign-in flow, and its Home action returns to `/docs`.

Signed-in sessions resolve a tenant from the Firebase user record and attach tenant/user headers to API requests. The hosted login callback completes authentication with a Firebase custom token.

## Prerequisites

- **Node.js 22** (developed on 22.13) and npm.
- **Angular CLI 19** comes in with `npm install`; run it with `npx ng`.
- **Firebase CLI** (`npm i -g firebase-tools`), only if you deploy. You also need access to the `taliferrotech` Firebase project; ask the project owner to add you.
- **The `taliferro-ui` repo, checked out next to this one.** `package.json` installs `@taliferro/ui` from `file:../../taliferro-ui`, so the folders must look like this:

  ```
  corporate/
  ├── taliferro-ui/          ← shared TODD UI package
  └── web-products/
      └── docs/              ← this repo
  ```

  Without it, `npm install` fails.

## Getting started

```bash
npm install
npm start          # http://localhost:4200
```

You don't need a `.env` file or any environment variables. The local dev server talks to the **production** API and Firebase project (see [Configuration](#configuration)), so anything you do while signed in changes real data.

### Signing in locally

Sign-in always happens on TODD's hosted login page. When the app runs on `localhost` or `127.0.0.1`, it sends you to `https://todd.taliferro.tech/login?client=docs-web-local&state=…` (see `DocsAuthService.signIn`). The hosted login must recognize the `docs-web-local` client and send you back to `http://localhost:4200/auth/callback`, so serve on port 4200. If the login page won't send you back, check the client registration on the TODD login side first.

You can browse most pages without signing in (see [Guest mode](#guest-mode)).

## Configuration

All configuration is compiled in from two files:

| File | Used by |
| --- | --- |
| `src/environments/environment.ts` | `npm start`, `ng build --configuration development` |
| `src/environments/environment.prod.ts` | `npm run build` (production) |

Both files currently hold the same values:

| Key | Purpose |
| --- | --- |
| `backendURL` | Base URL for every API call (`https://api.taliferro.tech/api`). Point it at a local or staging API here. |
| `apiKey` | Sent as `Authorization: Bearer …` to `/app-assistant` and `/document-helper`. Treat it as a secret. |
| `firebaseConfig` | Firebase web app config for the `taliferrotech` project (Auth, Firestore, Storage). |
| `taliferroTenantId` | The uid that gets admin-only header items (`DocsHeaderComponent.isAdmin`). |
| `production` | Standard Angular flag. |
| `PLATFORM_URL`, `COMPANY_NAME`, `linkPreview` | Not referenced by the app today. |

## Backend and services

### Taliferro API (`backendURL`)

Signed-in requests go through `docsTenantInterceptor`, which adds:

```
X-Tenant-Id:  <tenant resolved from users/{uid}>
X-User-Id:    <Firebase uid>
X-User-Email: <Firebase email>
```

| Endpoint | Used for | Service |
| --- | --- | --- |
| `GET/POST /docs`, `GET/PUT/DELETE /docs/:id` | Document vault CRUD | `DocService` |
| `POST /docs/compose` | Compose a document from a brief and knowledge entries | `DocService` |
| `GET /docs/limits` | Plan usage limits | `DocService` |
| `POST /docs/knowledge/suggest` | Knowledge suggestions while answering | `AnswerFormComponent` |
| `/docs/opportunities…` | RFP opportunities: list, detail, update, rescore, proposal plan, sections, send, submitted | `OpportunitiesService` |
| `/docs/inboxes…` | RFP intake inboxes: list, create, update, test, check, Google OAuth start | `OpportunitiesService` |
| `GET/POST /response-flows`, `GET/PUT/DELETE /response-flows/:id` | Knowledge Base / Response Flow entries | `ResponseFlowService` |
| `POST /response-flows/from-find` | Save to Knowledge from Find (`/knowledge/save`) | `FindSaveComponent` |
| `POST /app-assistant` | General AI assistant (bearer `apiKey`) | `OpenAiService` |
| `POST /document-helper` | Document and proposal AI helpers (bearer `apiKey`) | `DocsOpenAiService` |
| `GET /account/summary`, `POST /account/subscriptions/cancel` | Subscription and billing state | `AccountBillingService` |
| `GET/PATCH /profile`, `DELETE /account` | Profile and account deletion | `ProfileApiService` |
| `POST /onboarding/profile`, `POST /mobile/docs/knowledge-base` | Sign-up draft hand-off | `DocsSignupDraftService` |
| `GET /getting-started/docs` | Getting-started checklist | `GettingStartedService` |

### Firebase (`taliferrotech`)

- **Authentication.** The hosted login returns a custom token, and `/auth/callback` signs in with it.
- **Firestore.** The app reads `users/{uid}` to find the tenant, reads `tenants/{tenantId}/contacts`, and reads and writes the dropdown lists under `tenants/{tenantId}/…` (`DocsDropdownService`).
- **Storage.** Files are uploaded to `documents/{uid}/…` from the document editor and the answer form.

### Other hosts

- `https://todd.taliferro.tech` for hosted login, profile and Outreach social hand-off.
- The other `*.taliferro.tech` product URLs appear only as links in the universal platform menu.

The frontend is a client application. Firebase rules and the API must keep enforcing authorization and tenant isolation, and a guest request must never count as permission to read or write private workspace data.

## Scripts

| Command | What it does |
| --- | --- |
| `npm start` | Dev server on port 4200 |
| `npm run build` | Production build to `dist/docs/browser`. It runs `generate-version` first, which **rewrites `version` in `package.json` and `public/assets/version.json`** (`YYYY.M.D-build.N`). |
| `npm test` / `npm run test:ci` | Karma/Jasmine unit tests; `test:ci` runs once in headless Chrome |
| `npm run e2e` | Starts the dev server and runs Cypress against `http://localhost:4200` |
| `npm run cy:open` | Opens Cypress interactively |
| `npm run typecheck:cypress` | Type-checks the Cypress specs |

## Deployment

The supported path is:

```bash
npm run deploy:hosting   # runs ./deploy.sh
```

`deploy.sh` does the following, in order:

1. Selects the `taliferrotech` Firebase project.
2. Runs `npm run build`.
3. Runs `npm run test:ci` and `npm run e2e`.
4. **Commits everything in the working tree** (`git add -A`) as `Deploy Docs <timestamp>` on whatever branch you're on.
5. Runs `firebase deploy --project taliferrotech --only hosting:todd-docs`.

Commit or stash unrelated work before you run it. If any step fails, the script stops and nothing is deployed.

`firebase.json` rewrites every route to `index.html`, so Angular routes still work on direct links and refresh. The app also registers an Angular service worker (`ngsw-config.json`), so users may need a reload to pick up a new deploy.

## Current limitations and intent

This project is a working Docs/Knowledge product shell and integration layer, not a complete replacement for every TODD capability. Some views are previews until a user signs in, and the quality of live results depends on the API, Firebase data, tenant configuration, subscription state, and external hosted-login flow. The iOS surface is currently a product preview rather than a native iOS application.

The codebase is also being aligned with the related Network, Pulse, Outreach, Moves, and Social products. Shared conventions—especially build versions, footer/version reporting, authentication behavior, tenant headers, and TODD visual styling—should be standardized rather than independently reimplemented in each app.
