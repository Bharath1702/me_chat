# TwoChat — Private 1-to-1 Messaging App

TwoChat is a private, real-time messaging application designed specifically for two people. It is intentionally **not** a social network: there are no public channels, group chats, or external contacts.

---

## Features

- **Authentication & Security**: Scrypt password hashing, HMAC session tokens in HTTP-only cookies, session TTL cleanup.
- **Connection System**: Connection ID pairing mechanism (`XXX-XXXX`) ensuring strict 1-to-1 data isolation via DB multikey indexes.
- **Realtime WebSocket Messaging**: Bi-directional communication with ping/pong keepalives, reconnection backoff, typing indicators, and online presence.
- **Media Messaging & Audio Notes**: Image/media uploads to Cloudflare R2 with secure signed authorize URLs and audio recording.
- **Rich Message Interactions**: Emoji reactions, message editing, deletion (for me / for everyone), and reply threading.
- **Production Hardened**: Custom rate limiting, security headers (CSP, HSTS, X-Frame-Options), health check endpoints (`/api/health`, `/api/health/ready`), and GitHub Actions CI.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript (Strict Mode)
- **Styling**: Tailwind CSS v4 + Vanilla CSS tokens & Glassmorphism design
- **Database**: MongoDB Atlas via Mongoose
- **Storage**: Cloudflare R2 Object Storage (`@aws-sdk/client-s3`)
- **Realtime Engine**: Custom Node.js HTTP + `ws` server
- **Validation**: Zod schema validation
- **Testing**: Vitest with `mongodb-memory-server`

---

## Production Deployment Architecture

TwoChat can be deployed in two modes:

### Mode 1: Single Node Server Container (Recommended for VPS / Docker)
Run Next.js and the WebSocket engine on a single server container using `npm run start` (which executes `server.ts`).
- Server binds to `0.0.0.0:${PORT}`.
- WebSockets upgrade seamlessly on `/api/ws`.

### Mode 2: Hybrid Deployment (Vercel + Separate WebSocket Server)
- Deploy the Next.js App Router frontend and REST API routes to **Vercel**.
- Deploy `server.ts` to a persistent Node container environment (**Railway**, **Fly.io**, **Render**, or **DigitalOcean**).
- Set `NEXT_PUBLIC_WS_URL=wss://ws-server-domain.com/api/ws` in your Vercel environment variables.

---

## Environment Variables

Copy `.env.production.example` to `.env.local` for local development or set the variables in your hosting environment:

```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/twochat?retryWrites=true&w=majority
AUTH_SECRET=generate-a-secure-random-32-byte-secret-key-here
PORT=3000
HOSTNAME=0.0.0.0
NODE_ENV=production

# Public Configuration
NEXT_PUBLIC_APP_URL=https://your-app-domain.com
NEXT_PUBLIC_WS_URL=wss://your-ws-domain.com/api/ws # Optional if single server

# Storage Configuration
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=twochat-media
R2_PUBLIC_URL=https://pub-your-bucket-id.r2.dev
```

---

## Local Development & Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Local Dev Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000).

3. **Run Unit & Integration Tests**:
   ```bash
   npm test
   ```

4. **Run TypeScript Check & Linter**:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```

5. **Build & Test Production Server**:
   ```bash
   npm run build
   npm run start
   ```

---

## Operations & Maintenance

### Health Checks
- **Liveness Probe**: `GET /api/health`
- **Readiness Probe**: `GET /api/health/ready` (Checks active database connectivity)

### Disaster Recovery & Backups
- **MongoDB Atlas**: Automated daily snapshots enabled by default.
- **R2 Storage**: Versioning and object lock recommended for object retention.
