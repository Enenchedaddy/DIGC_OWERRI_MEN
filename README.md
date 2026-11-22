# DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI — Men's Fellowship Management Portal

A private, role-based community management platform for the Men's Fellowship of DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI (Imo State, Nigeria), featuring member registration with administrator approval, a searchable member directory, individual privacy controls, upcoming birthdays, Nigerian localization (`+234`, `₦`, `DD/MM/YYYY`, `Africa/Lagos`), and official announcements.

## Key Features
- **Public Welcome Portal**: Introduces fellowship gatherings and registration without exposing private member data.
- **Role-Based Access Control**:
  - **Pending Members**: Blocked from private directory, birthdays, and announcements until verified by an administrator.
  - **Approved Members**: Access dashboard, searchable/filterable directory, individual profiles, chronological birthdays, announcements, personal profile editing, portrait uploads, and granular privacy preferences.
  - **Administrators**: Approve/reject/suspend members, edit member records, export CSV, publish/pin/draft announcements, promote trusted administrators, and configure fellowship settings & default privacy policies.
- **Server-Enforced Privacy & Uploads**: Magic-byte image verification, private upload delivery, scrypt password hashing, and backend field-level privacy filtering.

## Documentation
- [Architecture Overview](docs/architecture.md)
- [Database Schema](docs/database.md)
- [Security & Privacy Policies](docs/security.md)
- [Setup & Admin Provisioning](docs/setup.md)
- [PostgreSQL / Supabase Migration](supabase/migrations/001_initial_schema.sql)
