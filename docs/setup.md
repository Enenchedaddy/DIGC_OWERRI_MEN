# Setup & Deployment Guide

## Environment Variables
Configure `.env` (or platform Secrets) based on `.env.example`:
- `PORT`: Server port (defaults to `3000`).
- `ADMIN_BOOTSTRAP_PASSCODE`: Optional server-side passcode required to use the `/api/auth/bootstrap-admin` endpoint. Leave empty during initial local setup to claim the first administrator interactively once, or set a strong secret before public deployment.
- `SESSION_SECRET`: Optional HMAC signing secret (falls back to a random per-process 32-byte key in memory if unset; set a persistent random secret in production).

## Provisioning the First Administrator
You have two secure options:
1. **Interactive First-Run Setup UI**: Start the app when no administrator exists yet. A banner on the landing page (or **Initial Admin Setup** on the sign-in screen) lets you create the first administrator account once, after which the setup locks automatically.
2. **CLI Script**: Run `npx tsx scripts/create-admin.ts` in the project root to create a new administrator or promote an existing user by email.

## Local Development
```bash
npm install
npm run dev
```
The portal runs on `http://localhost:3000`.

## Production Build & Start
```bash
npm run build
NODE_ENV=production npm start
```

## Standalone Google Cloud Run Deployment (Recommended for Public & iPhone Safari Access)
Google AI Studio preview URLs (`ais-dev-*.run.app` and `ais-pre-*.run.app`) sit behind an upstream Google hosting proxy (`/__cookie_check.html`) that triggers Safari cookie warnings on older or privacy-restricted iOS devices. To provide a single public link that opens directly in iPhone Safari, Android Chrome, WhatsApp links, and desktop browsers with zero Google proxy gate, deploy directly to your own Google Cloud Run service using the included `Dockerfile`:

```bash
gcloud run deploy digc-owerri-portal \
  --source . \
  --region europe-west2 \
  --allow-unauthenticated \
  --set-env-vars "NODE_ENV=production,SESSION_SECRET=$(openssl rand -hex 32)"
```

### Production Storage & Email Notes
- **Persistent Data**: The SQLite database (`data/fellowship.db`) and uploaded profile photos (`data/uploads/`) are stored in `/app/data`. Mount a persistent volume (e.g., Cloud Storage FUSE / Filestore / persistent disk) to `/app/data` in Cloud Run or run on a persistent-disk host (Render/Railway/Fly.io/VPS) so member registrations and uploaded photographs persist across restarts.
- **Transactional Password Reset Email**: Set `RESEND_API_KEY` and `EMAIL_FROM` in environment variables to deliver password reset links automatically.

## Custom Domain Mapping (`digcowerri.com`)
To serve the portal at **`https://digcowerri.com`**:
1. **Register the domain** `digcowerri.com` at your domain registrar.
2. **Map the domain** in Google Cloud Run (or your hosting provider) to the deployed service.
3. **Configure DNS & SSL** at your domain registrar using the `A`/`AAAA` or `CNAME` records provided by your host for `digcowerri.com` and `www.digcowerri.com`.
4. **Set `APP_URL`** in your production environment variables to `https://digcowerri.com`.

