# Security & Privacy Enforcement

1. **Password Storage**: Passwords are hashed using Node's `crypto.scryptSync` with a random 16-byte salt per user and verified via `crypto.timingSafeEqual`.
2. **Session Management**: Authenticated sessions use HMAC-SHA256 signed tokens stored in React state memory (`Authorization: Bearer`) paired with `HttpOnly; Secure; SameSite=None; Partitioned` cookies for authorized `<img>` asset requests. State-changing routes verify Bearer headers or same-origin headers.
3. **Role & Approval Gates**:
   - Newly registered accounts always start with `role = 'member'` and `membership_status = 'pending'`. Clients cannot self-assign roles or approval status.
   - All directory, birthday, and announcement routes pass through `requireApproved` middleware on the server, returning HTTP `403` for pending, suspended, or rejected accounts.
   - All administrative routes pass through `requireAdmin` middleware, verifying both `role === 'admin'` and `membership_status === 'approved'`.
4. **Server-Side Privacy Filtering**: `applyMemberPrivacy` in `server/security.ts` strips `phone_number`, `email`, `workplace`, `residential_location`, and `date_of_birth` (or strips birth year when `birthday_visibility = 'day_month'`) on the backend before JSON serialization.
5. **Private Upload Validation & Delivery**:
   - Uploads are capped at 5 MB and inspected by magic bytes (JPEG, PNG, WebP) rather than trusting file extensions.
   - Files are saved under random UUID filenames inside `data/uploads/` and served through `/api/uploads/:filename` with `path.resolve` boundary checks and owner/approved-member authorization.
6. **Administrator Provisioning**:
   - No public administrator signup exists.
   - Initial admin setup is available once on first run (or via `ADMIN_BOOTSTRAP_PASSCODE` in server environment variables) and via `npx tsx scripts/create-admin.ts`.
   - Existing administrators can promote approved members inside **Member Management**.
