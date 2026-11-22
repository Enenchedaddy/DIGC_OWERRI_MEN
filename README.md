# DIGC Owerri Men's Fellowship Directory

A private, approval-based member directory for the Men's Fellowship of Dunamis International Gospel Centre, Owerri.

## Product flow

1. A man registers and uploads his profile information.
2. His account remains pending and cannot read the directory.
3. An administrator verifies and approves the registration.
4. The approved member signs in directly to the member directory.
5. Members can search directory cards and open full profiles, subject to each member's privacy preferences.

Administrators are intentionally limited to membership access duties: approving, rejecting, suspending, editing, and exporting member records. The system supports no more than three administrators and prevents removal of the final approved administrator.

## Runtime

- Frontend: React 19, TypeScript, Tailwind CSS, and Vite on Vercel.
- API: Supabase Edge Function at `supabase/functions/portal-api`.
- Data and authentication: Supabase Postgres, Auth, and private Storage.
- Authorization: API validation, database constraints, and Row Level Security.

## Local development

```bash
npm install
npm run dev
```

Use `.env.example` as the environment-variable reference. Never expose the Supabase service-role key in the browser.

## Documentation

- [Architecture](docs/architecture.md)
- [Setup and administrator provisioning](docs/setup.md)
- [Database schema](docs/database.md)
- [Security and privacy](docs/security.md)
