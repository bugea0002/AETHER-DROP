# Security Summary

We performed a focused security review of the Google Authentication flow, Firestore global leaderboard rules, client leaderboard rendering, static file server, and dependencies. Three concrete issues were identified and fixed immediately, and the remaining authentication safeguards and trust boundaries were verified.

### What Was Fixed

1. **Restricted Public Static File Serving (`server.js`)**
   - **Issue**: The Express server previously exposed the entire project root directory (`express.static(__dirname)`), which allowed direct HTTP downloads of server code and configuration files such as `/server.js`, `/package.json`, and `/firestore.rules`.
   - **Fix**: Replaced root-level static serving with explicit allowlisted mounts (`/src`, `/styles`, `/assets`, `/vendor/firebase`) with dotfiles disabled, plus explicit routes only for `/`, `/index.html`, and `/firebase-applet-config.json`. Added baseline response headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`) and disabled `X-Powered-By`.

2. **Fixed Leaderboard Read Failure & Hardened Firestore Rules (`firestore.rules`, `src/firebase/FirebaseService.js`)**
   - **Issue**:
     - The leaderboard `allow list` rule evaluated `resource.data` fields that were not constrained in the client query, causing Firestore static rule evaluation to reject every global leaderboard read.
     - Collection list queries lacked a server-enforced document limit cap, path IDs only checked for slashes, `frameId`/`primaryWeaponId`/`titleId` lacked strict allowlists, and `headshots` could exceed `kills` or scores could be overwritten downward.
   - **Fix**:
     - Updated `allow list` to require `isValidBoardKey(boardKey) && request.query.limit != null && request.query.limit <= 50 && resource.data.score >= 0`, paired with a matching client query (`where('score', '>=', 0)`, `orderBy('score', 'desc')`, `limit(25)`). This resolves the read failure and caps bulk scraping per request.
     - Tightened `isValidId` to `^[a-zA-Z0-9_\-]+$`, added explicit allowlists for all valid frames, weapons, and titles, enforced `headshots <= kills`, and required monotonic score updates (`incoming().score >= existing().score`).
     - Validated with `npx eslint firestore.rules` and deployed live to Firestore.

3. **Eliminated Raw HTML Interpolation on Global Leaderboard Entries (`src/main.js`)**
   - **Issue**: Global leaderboard rows previously assembled HTML strings via `innerHTML` with user-supplied `callsign` and `titleLabel` fields from Firestore.
   - **Fix**: Rebuilt leaderboard rendering using safe DOM construction (`document.createElement` and `textContent`) and an allowlist-backed title plate builder (`createTitlePlateEl`), ensuring untrusted Firestore fields are never parsed as HTML.

### Verified Google Auth & Privacy Safeguards

- **Verified Google Sign-In Required for Writes**: Submitting or updating a leaderboard record requires a valid Firebase Auth token with a verified Google email (`request.auth != null && request.auth.token.email_verified == true`), using client-side `GoogleAuthProvider` + `signInWithPopup` with no server-side client secrets.
- **Strict Ownership & Anti-Spam Binding**: Each user can only create, update, or delete their own single document at `/leaderboards/{boardKey}/entries/{uid}` where `uid == request.auth.uid`, with immutable `uid`, `mode`, and `dateKey` fields and server-enforced timestamps (`updatedAt == request.time`).
- **Zero Personal Information Stored**: Email addresses, real names, and profile URLs are never written to Firestore — only the player's chosen `callsign` and game stats/title ID.
- **Honest Trust Boundary**: Because gameplay runs in the browser without an authoritative game server, Google Auth guarantees identity and prevents impersonation or overwriting other players' records, while schema rules enforce valid ranges; however, a determined client tampering with browser memory could still submit inflated numbers within valid numeric bounds under their own account.
- **Dependency Check**: `bun audit` reported only a transitive Node-side `@grpc/grpc-js` advisory under the `firebase` npm package (`@firebase/firestore-compat`); the application never executes Node-side Firestore or gRPC on the server and serves only browser ESM bundles from `/vendor/firebase`.

---

## PoC Verification

### 1. Public Exposure of Server & Config Files (`server.js`)
- **Before (Vulnerable)**: `GET http://127.0.0.1:3000/server.js` and `GET http://127.0.0.1:3000/package.json` returned `200 OK` with full source/configuration contents because `app.use(express.static(__dirname))` served the workspace root.
- **After (Verified Fixed)**:
  - `GET /` -> `200 OK` (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, no `X-Powered-By`)
  - `GET /firebase-applet-config.json` -> `200 OK`
  - `GET /src/main.js` -> `200 OK`
  - `GET /server.js` -> `404 Not Found`
  - `GET /package.json` -> `404 Not Found`
  - `GET /firestore.rules` -> `404 Not Found`

### 2. Firestore Leaderboard Query Compatibility & Schema Enforcement (`firestore.rules`, `src/firebase/FirebaseService.js`)
- **Before (Broken / Under-constrained)**:
  - Client issued `query(collection(db, 'leaderboards', boardKey, 'entries'), orderBy('score', 'desc'), limit(25))`.
  - `allow list` checked `resource.data.score is int && resource.data.score >= 0 && resource.data.callsign is string`, which Firestore cannot statically prove without matching query predicates, rejecting every read with `PERMISSION_DENIED`.
  - Unbounded `limit` queries and arbitrary `frameId`/`titleId` strings were not blocked in rules.
- **After (Verified Fixed)**:
  - Client issues `where('score', '>=', 0), orderBy('score', 'desc'), limit(25)`.
  - `allow list` requires `isValidBoardKey(boardKey) && request.query.limit != null && request.query.limit <= 50 && resource.data.score >= 0`, statically matching the query and rejecting queries without a limit or with `limit > 50`.
  - `npx eslint firestore.rules` exited with code `0` (zero errors/warnings) and rules were deployed live via `DeployRules`.

### 3. Safe Rendering of Untrusted Leaderboard Strings (`src/main.js`)
- **Before (Unsafe Sink)**: `renderLeaderboardPanel` concatenated `e.callsign` and `e.titleLabel` into a template literal assigned to `listEl.innerHTML`.
- **After (Verified Fixed)**: Every cell in `renderLeaderboardPanel` is created via `document.createElement` and populated strictly through `.textContent`, while the title badge class and SVG emblem are resolved exclusively from the static `PLAYER_TITLES` allowlist. Any `<script>` or HTML payload stored in a callsign renders inertly as plain text.
