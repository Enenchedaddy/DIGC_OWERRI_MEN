# Architecture

## Production path

- `src/`: React 19 directory interface and approval-gated routes.
- `src/services/api.ts`: Browser API client. In production it targets the Supabase `portal-api` Edge Function.
- `supabase/functions/portal-api/index.ts`: Registration, authentication, directory, profile, and administrator endpoints.
- `supabase/migrations/`: PostgreSQL schema, Row Level Security, private storage, and administrator constraints.
- Vercel: Static Vite frontend hosting.
- Supabase: Auth, Postgres, private Storage, and the Edge Function runtime.

The legacy Express/SQLite runtime remains available for local compatibility, but it is not the production deployment target.

## Authorization boundaries

The Edge Function validates every protected request and reads the caller's current profile status and role from the database. Pending, rejected, and suspended users cannot read the member directory. Administrator routes require an approved administrator.

The service-role credential exists only inside the Edge Function environment. Database triggers independently enforce a maximum of three administrators and preserve at least one approved administrator, protecting these invariants from concurrency and direct API misuse.

## Member privacy

Directory responses are assembled server-side. Contact, workplace, birthday, and location fields are filtered using each member's privacy preferences before data reaches the browser. Profile photos are validated on upload and stored in a private bucket; authorized image delivery is mediated by the API.
