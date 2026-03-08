# PlaylistVault

A full-stack web app that lets you connect Spotify, YouTube Music, SoundCloud, and Pandora to view all your playlists in one place and take point-in-time snapshots to preserve them forever.

## Tech Stack

| Layer    | Choice                                              |
|----------|-----------------------------------------------------|
| Frontend | Vite 6, React 19, TypeScript, React Router 7, Tailwind CSS 4 |
| Backend  | Bun, Hono                                           |
| Auth     | Lucia v3 + Arctic                                   |
| Database | Supabase / any Postgres                             |
| ORM      | Drizzle ORM                                         |

## Project Structure

```
playlist-vault/
├── apps/
│   ├── web/          # Vite + React 19 frontend  (port 5173)
│   └── api/          # Bun + Hono backend         (port 3001)
├── packages/
│   └── db/           # Drizzle schema + migrations (shared)
├── package.json      # Bun workspace root
└── bun.lockb
```

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- A Postgres database (e.g. [Supabase](https://supabase.com) free tier)
- OAuth app credentials for whichever services you want to connect

## Setup

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy the example files and fill in your values:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**`apps/api/.env`**

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (`postgresql://...`) |
| `LUCIA_SECRET` | Any random secret string (≥ 32 chars) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | From [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | From [Google Cloud Console](https://console.cloud.google.com) — enable YouTube Data API v3 |
| `SOUNDCLOUD_CLIENT_ID` / `SOUNDCLOUD_CLIENT_SECRET` | From [SoundCloud Developer](https://developers.soundcloud.com) |
| `PANDORA_CLIENT_ID` / `PANDORA_CLIENT_SECRET` | From Pandora partner program |
| `FRONTEND_URL` | URL of the web app (default: `http://localhost:5173`) |

**`apps/web/.env`**

| Variable | Description |
|---|---|
| `VITE_API_URL` | URL of the API server (default: `http://localhost:3001`) |

### 3. OAuth redirect URIs

Register these callback URLs in each provider's developer console:

| Provider | Redirect URI |
|---|---|
| Spotify | `http://localhost:3001/auth/spotify/callback` |
| Google (YouTube) | `http://localhost:3001/auth/youtube/callback` |
| SoundCloud | `http://localhost:3001/auth/soundcloud/callback` |
| Pandora | `http://localhost:3001/auth/pandora/callback` |

### 4. Run database migrations

```bash
cd packages/db && bun run migrate
```

To regenerate migrations after schema changes:

```bash
cd packages/db && bun run generate
```

### 5. Start the development servers

In separate terminals:

```bash
# API (port 3001)
cd apps/api && bun run dev

# Web (port 5173)
cd apps/web && bun run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Features

- **Unified playlist view** — all your playlists across every connected service in one grid
- **Provider filter** — quickly filter by Spotify, YouTube, SoundCloud, or Pandora
- **Sync** — pull the latest playlists and tracks from any or all connected services
- **Snapshots** — take an immutable point-in-time copy of any playlist's tracks; view or delete snapshots any time
- **No cookies** — sessions use `Authorization: Bearer` headers; OAuth state is stored server-side in the database

## API Routes

### Auth
| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/register` | Create account, returns `sessionId` |
| `POST` | `/auth/login` | Login, returns `sessionId` |
| `POST` | `/auth/logout` | Invalidate session |
| `GET` | `/auth/spotify` | Start Spotify OAuth flow |
| `GET` | `/auth/youtube` | Start YouTube OAuth flow |
| `GET` | `/auth/soundcloud` | Start SoundCloud OAuth flow |
| `GET` | `/auth/pandora` | Start Pandora OAuth flow |
| `DELETE` | `/auth/services/:provider` | Disconnect a service |

### Playlists
| Method | Path | Description |
|---|---|---|
| `GET` | `/playlists` | List all playlists for the current user |
| `POST` | `/playlists/sync` | Sync all connected services |
| `POST` | `/playlists/sync/:provider` | Sync one provider |
| `GET` | `/playlists/:id` | Get a playlist with its tracks |

### Snapshots
| Method | Path | Description |
|---|---|---|
| `POST` | `/playlists/:id/snapshots` | Create a snapshot |
| `GET` | `/playlists/:id/snapshots` | List snapshots for a playlist |
| `GET` | `/snapshots/:id` | Get a snapshot with full track data |
| `DELETE` | `/snapshots/:id` | Delete a snapshot |
