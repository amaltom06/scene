# Free SCENE demo on Vercel + MongoDB Atlas

The React frontend and Express API deploy together as one Vercel project. MongoDB Atlas stores accounts, events, reservations, messages, and uploaded profile photos. Both the website and `/api` use the same HTTPS domain, so sign-in cookies work without a separate backend host.

MongoDB Compass is the desktop database viewer. Keep using it to inspect Atlas, but the live app needs a cloud database rather than the MongoDB server on your computer.

This setup is for a personal demonstration. [Vercel Hobby](https://vercel.com/docs/plans/hobby) is free within its limits and permits personal, non-commercial use. Atlas has a [Free M0 cluster](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/) with limited storage. Paid ticket checkout remains unavailable in SCENE.

## 1. Create the free database

1. Sign in at [MongoDB Atlas](https://cloud.mongodb.com/) and create a project.
2. Create a **Free / M0** cluster. Choose a nearby available region and skip MongoDB's sample datasets.
3. Under **Database Access**, create a database user with a strong password. Give it `readWrite` access to the database **scene_demo**. This is separate from your Atlas website login.
4. Under **Network Access**, configure access for Vercel. Hobby functions use changing outbound IP addresses, so this demo setup needs the `0.0.0.0/0` entry. This makes the database network reachable; database authentication still applies. Use a dedicated demo database and its restricted database user. [Vercel IP documentation](https://vercel.com/kb/guide/how-to-allowlist-deployment-ip-address), [Atlas access documentation](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/).
5. Open **Connect → Drivers → Node.js** and copy the connection string. Insert the database username and password, and set the database path to `/scene_demo`:

   ```text
   mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/scene_demo?retryWrites=true&w=majority
   ```

   Percent-encode special characters in credentials. Keep this string in local ignored files and Vercel's server environment variables; it must never be a `VITE_` variable or committed to Git.

Connect Compass to this same string when you want to view the online records.

## 2. Populate the online demo

Create `.env.hosted.local` in the project root containing:

```dotenv
DEMO_MONGODB_URI=mongodb+srv://DATABASE_USER:ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/scene_demo?retryWrites=true&w=majority
```

Then run from `D:\project\scene`:

```powershell
rtk proxy npm run demo:seed:hosted
```

This inserts the 20 fictional profiles, 40 events, posts, friendships, and conversations directly into Atlas. It only accepts an authenticated Atlas URI for the database named `scene_demo`. It preserves existing records and interactions on reruns and does not copy personal records from the local database. Dates are relative to the first seed, so seed close to your presentation.

The hosted demo has no shared demo password. Create a normal account on the deployed site, choose Kochi, and join events to try passes and chats. Create your own event to try organiser controls. The known local demo credentials remain disabled in production.

## 3. Publish the current code to GitHub

Vercel needs the current deployment changes, including `api/index.js`, the `server/` helpers, and `vercel.json`, on GitHub. The configured repository is [amaltom06/scene](https://github.com/amaltom06/scene).

Commit and push the project changes before importing it. `.env`, `.env.*`, `.vercel/`, uploaded local photos, and build output are excluded from Git. `.env.example` is a placeholder template only.

## 4. Import the project into Vercel

1. Sign in at [Vercel](https://vercel.com/) with GitHub and use the **Hobby** plan.
2. Choose **Add New → Project**, then import `amaltom06/scene`.
3. Keep **Root Directory** at the repository root and **Framework Preset** as **Vite**. The tracked configuration builds with `npm run build`, serves `dist`, and routes `/api/*` to the Express function. Node.js **24.x** is pinned in `package.json`.
4. Before deployment, add these environment variables for **Production**:

   | Name | Value |
   | --- | --- |
   | `MONGODB_URI` | Your Atlas connection string ending in `/scene_demo` |
   | `AUTH_SECRET` | A new random secret, at least 32 characters |
   | `AVATAR_STORAGE` | `mongodb` |

   Generate an authentication secret locally and copy it into Vercel:

   ```powershell
   rtk proxy node -e "process.stdout.write(require('node:crypto').randomBytes(48).toString('hex'))"
   ```

5. Leave `VITE_API_BASE_URL` unset. Do not copy the localhost values for `CORS_ORIGIN` or `PUBLIC_APP_URL` from `.env.example`. Vercel's own deployment URLs are detected automatically. Enable system environment variables if you previously disabled them in Vercel.
6. Click **Deploy**. The resulting `https://YOUR-PROJECT.vercel.app` URL serves the frontend and backend together.

Environment variable changes require a redeploy. For preview deployments, add separate Preview environment variables pointing to a separate test database; otherwise preview APIs are intentionally unconfigured.

## 5. Check the live demo

1. Open `https://YOUR-PROJECT.vercel.app/api/health`. It should return HTTP 200 with `"database":"connected"`.
2. Sign up, sign in, set the city to Kochi, and verify the sample events appear.
3. Save and join a free event, open **My plans**, view a pass, and open the event chat.
4. Upload a profile photo under **3 MB**, reload, and confirm it persists. Hosted photos are MongoDB documents rather than temporary function files. The 3 MB cap fits under [Vercel's 4.5 MB function payload limit](https://vercel.com/docs/functions/limitations).
5. Test the shared URL in a mobile browser and in a private window.

Share the production URL. Preview deployment protection settings may require Vercel sign-in, so check the production URL while signed out of Vercel before sending it to someone.

## Email and common problems

Sign-up and sign-in work without an email provider. Email verification and password-reset delivery require `RESEND_API_KEY`, `EMAIL_FROM`, and `PUBLIC_APP_URL` set to your final HTTPS site URL, plus a verified sender. The app reports when email delivery is unavailable.

- **Database unavailable / HTTP 503:** check the URI credentials, `/scene_demo` path, Atlas database-user permissions, and network access. `localhost` cannot reach your computer from Vercel.
- **Origin is not allowed:** use the production deployment URL, keep system environment variables enabled, and set `PUBLIC_APP_URL` / `CORS_ORIGIN` to exact HTTPS origins if using a custom domain. Redeploy afterward.
- **API returns HTML / 404:** confirm the deployed commit contains the root `api/` directory and `vercel.json`, and that the Vercel Root Directory is the repository root.
- **Empty feed:** run the hosted seed and choose Kochi. Reruns preserve old schedules; ended events leave public discovery automatically.
- **Photo upload fails:** use a PNG, JPEG, or WebP under 3 MB and set `AVATAR_STORAGE=mongodb`.

The repository's [implementation status](IMPLEMENTATION_STATUS.md) documents features still pending before a commercial public launch. Local tests verify API behaviour and photo durability, but an actual Vercel deployment and Atlas connectivity must be verified after your accounts are connected.
