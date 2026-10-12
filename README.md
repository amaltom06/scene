# SCENE

SCENE is a location-first app for discovering and hosting real-world plans. Its current implementation covers the core account, Scene, map, and free participation journeys. It is **not yet production ready**; see [Implementation status](IMPLEMENTATION_STATUS.md).

The client is mobile-first. Signed-out visitors see only the account entry screen with Sign in and Sign up; the feed and bottom navigation appear after authentication and disappear again on logout.

Event discovery takes inspiration from [WhatsAround](https://whatsaround.app/policies/aboutUs) and [BookMyShow](https://in.bookmyshow.com/explore/events) while keeping SCENE's own community events and branding:

- Browse music, comedy, theatre, movie screenings, festivals, workshops, wellness, family activities, and local experiences. Home has category tiles and shortcuts for today, this weekend, free plans, and nearby events.
- Search and combine date, budget, format, category, availability, and plan-type filters. The For you collection uses account interests; it shows all events when no supported interests are set.
- Bookmark events to the account. Saved events persist across sessions and devices. Saving does not reserve admission, and events made private are hidden from users who no longer have access.
- Open **My plans** from the header or profile to see upcoming reservations, saved events across cities, pending approval requests, past plans, and an organiser dashboard with attendance and request counts.
- Confirmed free reservations have an authenticated pass with an attendee name and reservation reference. Passes become unavailable after leaving, and cancelled events show a cancelled pass. These are reservation summaries; automated QR scanning and paid ticket checkout are not implemented.
- Download calendar events with a one-hour reminder, share event links, and open venue directions. No third-party event inventory is imported.

## Run locally

1. Copy `.env.example` to `.env`. Set `MONGODB_URI` to a MongoDB instance and give `AUTH_SECRET` a long random value.
2. Run `npm install`.
3. Run `npm run dev:full` and open `http://localhost:5173`.

The API requires MongoDB for account and Scene operations. If MongoDB is unavailable, the client shows an error state and offers a retry. It does not invent sample activity.

| Command | Purpose |
| --- | --- |
| `npm run dev:full` | Start Vite and the Express API |
| `npm run dev` | Start Vite only |
| `npm run server` | Start the Express API only |
| `npm run build` | Build the client into `dist/` |
| `npm run lint` | Lint client and server |
| `npm test` | Run isolated MongoDB integration tests |

The integration test creates a uniquely named local test database, then removes that test database. It does not touch the configured application database.

## Configuration

`PORT`, `MONGODB_URI`, `CORS_ORIGIN`, and `AUTH_SECRET` configure the API. Production startup rejects the development auth secret. Set `PUBLIC_APP_URL` to the browser origin used in account emails.

Email verification and password reset use the Resend HTTP API when both `RESEND_API_KEY` and `EMAIL_FROM` are set. Without them, registration still works, but verification emails and password resets cannot be delivered. `RESEND_API_URL` can override the provider endpoint for local testing; leave it unset in production.

Accounts use email and password for sign-up, sign-in, and logout. Password reset and email verification require the configured email sender. Existing Google-created accounts can set a password through the reset link if email delivery is configured. Set `VITE_API_BASE_URL` only when the client and API have different origins; otherwise proxy `/api` to the API.

Profile photos can be uploaded as PNG, JPEG, or WebP images up to 5 MB. Files are saved under `AVATAR_UPLOAD_DIR` (default `uploads/avatars`) and served from `/api/avatars/`. Keep this directory on persistent storage in deployment; it is ignored by Git.

## Implemented API

- Account: `/api/auth/register`, `/login`, `/logout`, `/me`, `/verify`, `/verification/request`, `/password/forgot`, `/password/reset`
- Profiles: `PATCH /api/users/me`, `POST /api/users/me/avatar`, `GET /api/avatars/:filename`, `GET /api/users/:username`, plus the existing people and friend routes
- Scenes: list with search, filters and pagination; nearby geospatial search; detail; create draft/publish; edit; cancel; join; leave; host join-request management; member-only messages
- Personal discovery: `GET /api/scenes?saved=1`, `?requested=1`, `?forYou=1`; optional `maxPrice` and `locationType` filters
- Saved events: `PUT /api/scenes/:sceneId/save`, `DELETE /api/scenes/:sceneId/save`; the authenticated user includes `savedSceneIds`
- Free reservation pass: `GET /api/scenes/:sceneId/pass` (confirmed members only)
- Existing posts: list, create from an HTTPS media URL, and like
- Health: `GET /api/health`

All Scene writes derive ownership from the session. Public discovery omits private and unlisted Scenes, drafts, cancelled Scenes, and ended scheduled Scenes. The map uses stored GeoJSON points and never publishes a person's live location.

## Populated local demo

The local database now contains a connected fictional community: **20 profiles, 40 events across 6 cities, 15 posts, 30 chat messages, and 12 friendship records**. Kochi has the largest collection. All 21 event categories are represented. These records are labelled as demo content; venues and map pins are illustrative, and they do not represent verified real people or bookable live events.

Open `http://localhost:5173` and sign in with:

- Email: `demo_aarav@demo.scene.test`
- Password: `SceneDemo!2026`

Aarav has confirmed plans and passes, 4 saved events, a pending pottery request, past/cancelled attendance, and 3 hosted scenes including a private draft and an approval event with pending guests. Try Home, Explore, Nearby, Posts, People, My plans, Chats, and the organiser desk.

To populate another local checkout, run `npm run demo:seed`. The seed validates schema and graph relationships before insertion, rejects production and remote/system databases, and preserves existing accounts and all interactions when rerun. Other fictional profiles have no password and cannot sign in. Reserved `.test` emails are unverified; seeding sends no account emails. Set `DEMO_PASSWORD` before the first seed to choose a different demo password; rerunning never changes an existing password.

Schedules are relative to the first seed time in `Asia/Kolkata`; rerunning preserves dates and content. The demo includes intentional past, cancelled, full, draft, and private scenarios. Public discovery hides unavailable private/draft/ended/cancelled records according to the same rules as normal events.

Profile avatars are local illustrations. Generic event photos come from the verified public image URLs in `server/demo-data.js`; cached JPEGs under `public/demo/images` let demo event cards and posts load without external requests. `npm run demo:assets` refreshes these cached assets when network access is available. These photos illustrate activities rather than the fictional named people or exact events.

## Deployment notes

Deploy the Vite `dist/` files through a static host and `server/index.js` as the API. Use HTTPS, a managed MongoDB service, a strong `AUTH_SECRET`, explicit `CORS_ORIGIN`, and a configured email sender. Proxy `/api` or set `VITE_API_BASE_URL` at build time. Paid bookings are disabled until a verified payment provider is integrated; no card details are collected.

Review the remaining security, privacy, accessibility, and operations work in [Implementation status](IMPLEMENTATION_STATUS.md) before a public launch.
