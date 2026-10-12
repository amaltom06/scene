# SCENE implementation status

## Populated local demo community

- Added an explicit `npm run demo:seed` workflow and populated the running local database with 20 fictional profiles, 40 scenes, 15 posts, 30 member messages, and 12 friendships. Existing accounts and scenes are preserved.
- Extracted shared Mongoose models so the API and seed use identical schema validation. Seeded records carry `isDemo` plus stable unique keys; reseeding preserves IDs, credentials, attendance, likes, saved events, requests, friendships, content, and timestamps.
- Validated categories, India schedules, capacities, member counts, host references, approved/pending states, saved-event access, chat membership, post authors/likes, and friendship pairs before any record insertion. Seed targets are restricted to named local development databases.
- Added clear demo disclosure, biography/interest-rich People entries, and display names/avatars in Posts. Demo credentials cannot sign in when the API runs in production mode.
- Added 20 local illustrated profile avatars and cached 15 verified activity photos. Demo cards and posts prefer the local cache, with their original HTTPS source as fallback.
- Added disposable-database tests for graph integrity, real-account collision prevention, authentication, discovery, geospatial access, My plans, chat/passes, joining, friendship acceptance, organiser approval, and complete rerun preservation. All 6 tests pass, including existing coverage.

## Event discovery and reservation expansion

- Added shared event categories including comedy, theatre, screenings, festivals, wellness, family, and experiences, with home category tiles and date/free/nearby shortcuts. Added more Indian city map presets.
- Added date presets, budget and format controls, interest-based For you discovery, real total counts, search retry/clear actions, and saved-event filtering.
- Added authenticated, idempotent account bookmarks with privacy checks and access-aware saved listings. Demo fixtures are inserted only through the explicit local seed workflow; no third-party event inventory is imported.
- Added My plans with upcoming reservations, saved finds across cities, approval requests, past/cancelled plans, and organiser counts. Personal listings load all available pages and ignore stale refresh responses.
- Added protected free reservation summaries with stable reference codes, cancellation status, admission details, and organiser instructions. Membership authorizes passes; leaving removes pass access. Paid passes and QR entry validation remain unavailable.
- Added native event sharing with clipboard fallback, venue directions, and standards-compliant calendar exports with UTF-8 line folding, escaped text, absolute event times, and a one-hour reminder.
- Added focus containment, Escape handling, focus restoration, and scroll locking to event and pass dialogs. Full browser accessibility and responsive visual QA remain pending because this session has no available browser surface.
- Extended MongoDB integration coverage for bookmarks, privacy changes, interest recommendations, pass authorization/revocation, approval tracking, and cancelled passes. Added calendar/date shortcut tests.

## Delivered in this iteration

- Audited the React 19/Vite client, Express 5 API, Mongoose 9 models, authentication, map, posts, and deployment setup. Kept the existing stack and data models.
- Added the black, red, electric-green neo-brutalist styling, a five-destination mobile navigation, real profile data, and manual city onboarding.
- Added email verification and password-reset endpoints using configurable Resend delivery, session revocation on logout/reset, a production secret check, and account request throttling.
- Kept email/password as the only sign-in method, removed Google sign-in, and added authenticated PNG/JPEG/WebP profile-photo uploads with a device picker and preview.
- Extended Scenes with drafts, visibility, quick/planned type, timezone-aware schedule, registration deadline, host ID, GeoJSON point, geospatial/time indexes, address, tags, and instructions. Existing documents remain readable without deleting or migrating user data.
- Added a multi-step planned Scene wizard, quick Scene form, map pin selection, preview, save draft, publish, edit, cancel, direct links, and host join-request controls.
- Added real discovery sections, server-side text/category/date/price/type/availability filters, sorting, pagination, nearby radius search, map/list toggle, and simple marker clustering.
- Made free joins capacity-safe and idempotent; added host approval, leave, and member-only Scene chat. Paid booking endpoints now explicitly decline reservations until a verified payment provider exists.
- Added integration tests using a unique temporary MongoDB database and a local mock email service. Tests cover registration, profile editing, email verification, password reset, session revocation, scene validation, drafts, publishing, geospatial discovery, private visibility, editing authorization, simultaneous capacity competition, approval, leaving, cancellation, and chat authorization.

## Models and data compatibility

`User` and `Scene` gained additive fields. `Scene` now has a sparse `2dsphere` index and a city/publication/visibility/time index. Existing `Message`, `Booking`, `Post`, and `FriendRequest` collections remain. No destructive migration ran. Legacy Scenes with text-only `date`/`time` remain visible, but need their host to set `startsAt` and `endsAtDate` before automatic end-of-event filtering can apply.

## External services and limitations

- Email delivery needs a real Resend API key and verified sender domain. The account flow accurately reports when it is not configured.
- Email/password is the supported sign-in method. Uploaded profile photos need persistent storage in production. Map tiles and Leaflet currently load from third-party CDNs; production should review CDN availability, caching, and content security policy.
- Map centering and pin selection currently support the five built-in city presets. Other manually entered cities remain usable in the list, but need a geocoding integration for map navigation. Quick Scenes without a pinned venue appear in city discovery rather than radius search.
- Posts still accept HTTPS media URLs rather than uploaded files. The existing friend feature is not yet a complete following network. Chat is persisted and access-controlled, but delivery is request-based rather than real-time.
- Payments, paid tickets, QR check-in, communities, Circles, 24-hour Scene Moments, social feed visibility and moderation, notifications, Scene Pulse, organizer analytics, and recommendations remain future phases. Their UI does not claim they are complete.
- Account deletion/data export, age policy enforcement, distributed rate limiting, full CSRF defense, operational monitoring, and a complete security/privacy/accessibility audit remain before public deployment. No production-readiness claim is made.

## Verification

Run `npm run lint`, `npm run build`, and `npm test`. The test suite uses local MongoDB and removes only its uniquely named test database. The client and API can be started with `npm run dev:full`; check `/api/health` for database connectivity.
