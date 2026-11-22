# Database Schema

The portal uses a normalized relational schema across 9 tables:

1. **`users`**: Authentication identities (`id`, `email`, `password_hash`, timestamps), kept separate from directory profile data.
2. **`profiles`**: Member directory records (`id` FK -> `users.id`, personal, vocational, fellowship fields, and `membership_status` in `pending | approved | rejected | suspended`).
3. **`user_roles`**: Authorization role assignments (`user_id` FK -> `users.id`, `role` in `admin | member`).
4. **`profile_privacy`**: Per-member visibility preferences (`phone_visibility`, `email_visibility`, `workplace_visibility`, `birthday_visibility`, `location_visibility`).
5. **`announcements`**: Fellowship notices (`title`, `content`, `image_url`, `is_pinned`, `status` in `draft | published`, `created_by`).
6. **`announcement_reads`**: Tracks which members have marked published announcements as read (`UNIQUE(announcement_id, user_id)`).
7. **`activity_logs`**: Audit log of registrations, sign-ins, approvals, role changes, exports, and settings updates.
8. **`fellowship_settings`**: Portal-wide configuration (`fellowship_name`, `tagline`, `meeting_schedule`, `meeting_location`, and default visibility policies for new registrants).
9. **`password_resets`**: Expiring SHA-256 hashed password reset tokens.

All tables use UUID primary keys, foreign key cascading/nullifying constraints, and indexes on `membership_status`, `full_name`, `occupation`, and `announcements(status, is_pinned, created_at)`.
