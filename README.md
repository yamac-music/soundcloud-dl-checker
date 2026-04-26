# SoundCloud DL Checker MVP

Expo/React Native MVP scaffold for checking whether a SoundCloud track appears downloadable from public page metadata, then storing the result locally.

## Scope

- Accept a SoundCloud URL from manual input
- Be structurally ready for later share-sheet intake
- Resolve `on.soundcloud.com` short URLs
- Inspect public SoundCloud page HTML/embedded metadata
- Classify result as `downloadable`, `not_downloadable`, or `unknown`
- Store local history on-device

This scaffold does not implement audio download, file persistence, or any private SoundCloud API usage.

## Practical Implementation Plan

### Phase 1: MVP scaffold in this repo

1. Bootstrap an Expo + TypeScript project with Expo Router for simple screen composition.
2. Define stable domain types for URL intake, check results, and persisted history records.
3. Build a single intake pipeline:
   - accept manual URL input now
   - keep an explicit `source` field so future share-sheet intake can use the same path
4. Implement URL handling:
   - normalize user input
   - validate supported SoundCloud hosts
   - resolve short links through `fetch` redirect handling
5. Implement public-page metadata inspection:
   - fetch resolved track page HTML
   - extract title/artist/artwork where available
   - look for a public `downloadable` flag in HTML payloads
   - fall back to `unknown` on fetch/parse/spec drift
6. Persist records locally with AsyncStorage, newest first.
7. Expose three screens:
   - Home: input, run check, latest result
   - History: saved checks, ordered newest first
   - Detail: full stored record, external-link open, placeholder note display

### Phase 2: hardening after first run on devices

1. Verify redirect behavior for `on.soundcloud.com` in Expo runtime on iOS and Android.
2. Confirm that SoundCloud page fetches are not blocked by platform networking, anti-bot responses, or HTML shape changes.
3. Expand parsing heuristics using real samples from multiple public tracks.
4. Add filtered history views and note editing.
5. Decide whether AsyncStorage remains sufficient or should be replaced with SQLite for queryable history.

### Phase 3: share-sheet support

1. Add native share target plumbing for iOS/Android.
2. Convert inbound shared text/URL payloads into the existing intake request shape.
3. Route the app directly into the same check pipeline used by manual input.

## Architecture

### Routing

- `app/index.tsx`: home screen
- `app/history.tsx`: history list
- `app/record/[id].tsx`: record detail

### Source layout

- `src/context`: history/checking state and app-level actions
- `src/screens`: screen UI shells
- `src/services`: URL normalization, SoundCloud fetch/parse, share-intake abstraction
- `src/storage`: AsyncStorage adapter
- `src/types`: domain contracts
- `src/components`: small reusable UI blocks

## Key Technical Decisions

- Expo Router over a hand-wired navigation stack: faster MVP setup, easy route-based growth, and straightforward future deep-link/share integration.
- TypeScript everywhere: keeps the check pipeline and persisted record shape explicit from the start.
- AsyncStorage for MVP history: enough for append/read use cases with low setup cost. SQLite can replace it if filtering and scale requirements increase.
- Public-page inspection only: stays aligned with the requirements and keeps downloadability judgment separate from any download mechanism.
- Single intake pipeline: manual URL entry is the current UI, but the internal request shape already anticipates future share-sheet sources.

## Known Risks

- SoundCloud HTML structure is not stable. Parsing may break without warning, so `unknown` must remain the safe default.
- Some environments may not expose the final redirected URL consistently through `fetch`, especially for short-link resolution.
- Mobile networking or anti-bot protection may return different HTML than a desktop browser, reducing parser reliability.
- AsyncStorage is simple but not ideal for advanced querying, deduplication, or larger offline collections.
- Share-sheet support is not included in this scaffold and will require native-specific work beyond plain Expo routing.

## Next Steps

1. Install dependencies with the package manager of choice.
2. Run the app in Expo and test a mix of direct and short SoundCloud URLs on real devices.
3. Replace placeholder parsing heuristics with validated extraction rules from captured public page samples.
4. Add note editing and status filtering once the core fetch path is proven stable.

