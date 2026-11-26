# AETHER DROP Security Architecture Specification

## 1. Threat Model & Privacy Boundaries
- **Public Global Leaderboard (`/leaderboards/{boardKey}/entries/{uid}`)**: Designed to be readable by all players (signed-in or browsing the title screen) so competitive scores, callsigns, and earned Titles (`칭호`) are shared globally.
- **Zero PII Guarantee**: Email addresses, real names, OAuth tokens, and private account details are strictly excluded from `/leaderboards/{boardKey}/entries/{uid}` documents and rules. Only player-chosen `callsign` (1..18 chars) and game `titleLabel` (1..28 chars) are stored.
- **Healthcheck (`/test/connection`)**: Non-sensitive single-document read (`allow get: if docId == 'connection';`) used exclusively for `getDocFromServer` connectivity verification.

## 2. Authentication & Identity Assurance
- Writes require Firebase Auth via verified Google Sign-In (`request.auth != null && request.auth.token.email_verified == true`).
- Ownership is bound via the exact subcollection path `/leaderboards/{boardKey}/entries/{uid}` where `uid == request.auth.uid` and strict character validation (`^[a-zA-Z0-9_\-]+$`) applies on `create`, `update`, and `delete`.

## 3. Eight Pillars Alignment
1. **No Blanket Reads on PII**: Default deny on `/{document=**}`; zero PII collections exist.
2. **Zero Client-Side Auth Bypass**: No `allow ...: if true` on writes; `allow get` on `/test/connection` strictly scoped to `docId == 'connection'`.
3. **Immutable Ownership & Timestamping**: `uid`, `mode`, `dateKey` cannot change on update; `updatedAt == request.time` enforced on every write.
4. **Strict Schema Enforcement**: `keys().hasAll(...)` and `keys().hasOnly(...)` on create; `diff(resource.data).affectedKeys().hasOnly(...)` on update.
5. **Bounded Numeric, String & Enum Allowlists**: `callsign` 1..18 chars, `titleLabel` 1..28 chars, `heat` integer 0..10, `wave` 1..9999, `score` 0..2B, `kills` 0..1M, `headshots <= kills`, `elapsedSec` 0..86400, plus explicit allowlists for `mode`, `frameId`, `primaryWeaponId`, and `titleId`.
6. **Non-Decreasing PB Updates**: Updates require `incoming().score >= existing().score`, preventing score downgrade corruption while allowing callsign/title updates.
7. **Deterministic Resource Targeting**: One document per `(boardKey, uid)` prevents cross-user overwrite and spam flooding.
8. **Query-Compatible & Bounded `allow list`**: `allow list` requires `isValidBoardKey(boardKey) && request.query.limit != null && request.query.limit <= 50 && resource.data.score >= 0`, matching the client's `where('score', '>=', 0)` + `orderBy('score', 'desc')` + `limit(25)` query while blocking unbounded collection scrapes.
