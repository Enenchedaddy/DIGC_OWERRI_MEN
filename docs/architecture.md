# Architecture Overview

## Stack Adaptation
This project runs on the workspace's full-stack TypeScript runtime:
- **Frontend**: React 19 + TypeScript + Tailwind CSS v4 (`src/`)
- **Backend API & Static Host**: Express (`server.ts`) serving both `/api/*` endpoints and Vite in development / `dist/` in production on port `3000`
- **Database**: Relational SQLite via `better-sqlite3` (`server/db.ts`) stored in `data/fellowship.db` with foreign keys enabled, plus an equivalent PostgreSQL/Supabase RLS migration in `supabase/migrations/001_initial_schema.sql`.
- **Private Media Storage**: Uploaded portraits and announcement images are validated via magic-byte inspection and stored in `data/uploads/`, served strictly through authorized `/api/uploads/:filename` routes.

## Module Boundaries
- `server/db.ts`: Schema creation, foreign-key constraints, indexes, initial sample member/announcement seeding (without hardcoded admin accounts).
- `server/security.ts`: `scrypt` password hashing, HMAC-SHA256 session tokens, magic-byte file verification, input validation, CSV formula neutralization, and server-side privacy field filtering.
- `server.ts`: Express route handlers enforcing `requireAuth`, `requireApproved`, and `requireAdmin` middleware.
- `scripts/create-admin.ts`: Interactive CLI administrator provisioning script.
- `src/context/AuthContext.tsx` & `src/services/api.ts`: Client-side session management holding Bearer tokens in memory (never `localStorage`) plus HttpOnly partitioned cookies for private image requests.
- `src/pages/*`: Distinct public, member, and administrator views routed behind role and approval guards in `src/App.tsx`.
