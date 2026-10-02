# SCENE

SCENE is a premium local-meetup application: discover plans, create a scene, request to join, and talk to the group.

## Run locally

1. Copy `.env.example` to `.env` and set a MongoDB connection string.
2. Install dependencies with `npm install`.
3. Start the client and API together with `npm run dev:full`.
4. Open the Vite URL shown in the terminal (normally `http://localhost:5173`).

The frontend remains interactive with its built-in sample scenes when MongoDB is unavailable. Connect MongoDB for persisted scenes, join requests, and messages.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the React development server |
| `npm run server` | Start the Express API |
| `npm run dev:full` | Start both services |
| `npm run build` | Build the production client |
| `npm run lint` | Lint client and server JavaScript |

## Production configuration

Set these environment variables in the deployment platform:

```env
PORT=4000
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster.example/scene
CORS_ORIGIN=https://your-scene-domain.com
AUTH_SECRET=replace-with-a-long-random-secret-before-production
VITE_API_BASE_URL=https://api.your-scene-domain.com
```

Build the client with `npm run build`; deploy `dist/` through your static host, and deploy `server/index.js` as the API service. Set `VITE_API_BASE_URL` only if the client and API use different domains; leave it blank when the static host proxies `/api` to the API service.

## API

- `GET /api/health`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/scenes`
- `POST /api/scenes`
- `POST /api/scenes/:sceneId/join`
- `GET /api/scenes/:sceneId/messages`
- `POST /api/scenes/:sceneId/messages`

Authentication uses signed, HTTP-only, seven-day session cookies and passwords are hashed with Node's built-in scrypt implementation. Set a unique, long `AUTH_SECRET` in every production environment and use HTTPS so the session cookie is secure.
