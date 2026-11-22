import Database from 'better-sqlite3';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { hashPassword } from './security.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DB_PATH = path.join(DATA_DIR, 'fellowship.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone_number TEXT NOT NULL,
      profile_image TEXT,
      date_of_birth TEXT,
      gender TEXT DEFAULT 'Male',
      country TEXT DEFAULT 'Nigeria',
      state TEXT DEFAULT 'Imo State',
      city TEXT DEFAULT 'Owerri',
      lga TEXT,
      street_address TEXT,
      residential_location TEXT,
      occupation TEXT,
      workplace TEXT,
      professional_designation TEXT,
      skills TEXT,
      membership_category TEXT,
      date_of_joining TEXT,
      fellowship_responsibilities TEXT,
      biography TEXT,
      membership_status TEXT NOT NULL DEFAULT 'pending' CHECK (membership_status IN ('pending', 'approved', 'rejected', 'suspended')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_roles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS profile_privacy (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      phone_visibility TEXT NOT NULL DEFAULT 'members' CHECK (phone_visibility IN ('members', 'admins_only', 'private')),
      email_visibility TEXT NOT NULL DEFAULT 'members' CHECK (email_visibility IN ('members', 'admins_only', 'private')),
      workplace_visibility TEXT NOT NULL DEFAULT 'members' CHECK (workplace_visibility IN ('members', 'admins_only', 'private')),
      birthday_visibility TEXT NOT NULL DEFAULT 'day_month' CHECK (birthday_visibility IN ('day_month', 'full_date', 'admins_only', 'private')),
      location_visibility TEXT NOT NULL DEFAULT 'members' CHECK (location_visibility IN ('members', 'admins_only', 'private')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      image_url TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS announcement_reads (
      id TEXT PRIMARY KEY,
      announcement_id TEXT NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      read_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(announcement_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS activity_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      details TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS fellowship_settings (
      id TEXT PRIMARY KEY,
      fellowship_name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      logo_url TEXT,
      description TEXT NOT NULL,
      meeting_schedule TEXT NOT NULL,
      meeting_location TEXT NOT NULL,
      default_phone_visibility TEXT NOT NULL DEFAULT 'members',
      default_email_visibility TEXT NOT NULL DEFAULT 'members',
      default_workplace_visibility TEXT NOT NULL DEFAULT 'members',
      default_birthday_visibility TEXT NOT NULL DEFAULT 'day_month',
      default_location_visibility TEXT NOT NULL DEFAULT 'members',
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      remember_me INTEGER NOT NULL DEFAULT 1,
      expires_at TEXT NOT NULL,
      revoked_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(membership_status);
    CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(full_name);
    CREATE INDEX IF NOT EXISTS idx_profiles_occupation ON profiles(occupation);
    CREATE INDEX IF NOT EXISTS idx_announcements_status_pinned ON announcements(status, is_pinned, created_at);
    CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
  `);

  // Safe schema migration for existing SQLite databases
  const existingCols = new Set(
    (db.prepare('PRAGMA table_info(profiles)').all() as Array<{ name: string }>).map((c) => c.name)
  );
  const addressMigrations: Array<[string, string]> = [
    ['country', "ALTER TABLE profiles ADD COLUMN country TEXT DEFAULT 'Nigeria'"],
    ['state', "ALTER TABLE profiles ADD COLUMN state TEXT DEFAULT 'Imo State'"],
    ['city', "ALTER TABLE profiles ADD COLUMN city TEXT DEFAULT 'Owerri'"],
    ['lga', 'ALTER TABLE profiles ADD COLUMN lga TEXT'],
    ['street_address', 'ALTER TABLE profiles ADD COLUMN street_address TEXT'],
  ];
  for (const [col, ddl] of addressMigrations) {
    if (!existingCols.has(col)) {
      db.exec(ddl);
    }
  }

  const officialChurchName = 'DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI';
  const officialTagline = "Men's Fellowship · Brotherhood, Stewardship & Service";
  const officialDescription =
    "A private digital home connecting the men of DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI for accountability, mentorship, fellowship gatherings, and practical service across Imo State and beyond.";
  const officialSchedule = 'First & Third Saturdays · 7:30 AM (WAT)';
  const officialLocation = 'Dunamis International Gospel Centre, Owerri, Imo State, Nigeria';
  const officialLogo = '/src/assets/images/dunamis_owerri_logo_1795268208018.jpg';

  const settingsCount = db.prepare('SELECT COUNT(*) as cnt FROM fellowship_settings').get() as { cnt: number };
  if (settingsCount.cnt === 0) {
    db.prepare(`
      INSERT INTO fellowship_settings (
        id, fellowship_name, tagline, logo_url, description, meeting_schedule, meeting_location,
        default_phone_visibility, default_email_visibility, default_workplace_visibility,
        default_birthday_visibility, default_location_visibility
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      'default',
      officialChurchName,
      officialTagline,
      officialLogo,
      officialDescription,
      officialSchedule,
      officialLocation,
      'members',
      'members',
      'members',
      'day_month',
      'members'
    );
  } else {
    db.prepare(`
      UPDATE fellowship_settings
      SET fellowship_name = ?,
          tagline = ?,
          logo_url = ?,
          description = ?,
          meeting_schedule = ?,
          meeting_location = ?,
          updated_at = datetime('now')
      WHERE id = 'default'
        AND fellowship_name IN ('Covenant Men''s Fellowship', 'Dunamis Owerri Central Church')
    `).run(
      officialChurchName,
      officialTagline,
      officialLogo,
      officialDescription,
      officialSchedule,
      officialLocation
    );

    db.prepare(`
      UPDATE fellowship_settings
      SET logo_url = ?,
          updated_at = datetime('now')
      WHERE id = 'default' AND logo_url = '/assets/aistudio/image_8c5a355f.jpeg'
    `).run(officialLogo);
  }

  seedInitialFellowshipRecords();
  migrateSampleSeedRecordsToNigeria();
}

function migrateSampleSeedRecordsToNigeria() {
  const sampleUpdates: Array<{
    email: string;
    full_name?: string;
    phone_number: string;
    country: string;
    state: string;
    city: string;
    lga: string;
    street_address: string;
    residential_location: string;
    workplace: string;
    biography?: string;
  }> = [
    {
      email: 'marcus.boateng@fellowship.example',
      phone_number: '+234 803 234 8910',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri Municipal',
      street_address: '14 Okigwe Road, New Owerri',
      residential_location: 'New Owerri, Imo State, Nigeria',
      workplace: 'Imo Concorde Engineering Partners',
      biography:
        'Serving in the fellowship for over seven years with a focus on mentoring young fathers and coordinating church infrastructure and community outreach across Owerri.',
    },
    {
      email: 'rohan.kulkarni@fellowship.example',
      phone_number: '+234 806 391 4421',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri North',
      street_address: '28 Egbu Road, Works Layout',
      residential_location: 'Works Layout, Owerri, Imo State, Nigeria',
      workplace: 'Federal University Teaching Hospital, Owerri',
      biography:
        'Passionate about bridging faith and daily vocation, leading our Thursday evening scripture and prayer cell in Owerri North.',
    },
    {
      email: 'arthur.pendelton@fellowship.example',
      phone_number: '+234 805 612 0084',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Orlu',
      lga: 'Orlu',
      street_address: '7 Amaigbo Road',
      residential_location: 'Orlu, Imo State, Nigeria',
      workplace: 'Alvan Ikoku Educational Trust',
      biography:
        'Married 31 years with three grown sons. Available for marriage counsel, career guidance, and hospitality support across Imo State.',
    },
    {
      email: 'daniel.tan@fellowship.example',
      phone_number: '+234 809 782 1953',
      country: 'Nigeria',
      state: 'Rivers State',
      city: 'Port Harcourt',
      lga: 'Obio/Akpor',
      street_address: '19 Tombia Extension, GRA Phase 2',
      residential_location: 'Port Harcourt, Rivers State, Nigeria',
      workplace: 'Niger Delta Digital Studio',
      biography:
        'Tech lead grateful for a grounded brotherhood in Owerri and Port Harcourt. Enjoys community outreach, media ministry, and mentoring young graduates.',
    },
    {
      email: 'samuel.okafor@fellowship.example',
      phone_number: '+234 813 844 3302',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri West',
      street_address: '5 Nekede Exclusive Gardens',
      residential_location: 'Ihiagwa, Owerri West, Imo State, Nigeria',
      workplace: 'Okafor & Nwosu Chartered Accountants',
      biography:
        'Recently joined the Owerri congregation and eager to serve in Christian financial stewardship workshops and brotherhood welfare.',
    },
  ];

  const updateProfile = db.prepare(`
    UPDATE profiles
    SET phone_number = ?,
        country = ?,
        state = ?,
        city = ?,
        lga = ?,
        street_address = ?,
        residential_location = ?,
        workplace = ?,
        biography = COALESCE(?, biography),
        updated_at = datetime('now')
    WHERE email = ? AND phone_number LIKE '+1 (555)%'
  `);

  for (const s of sampleUpdates) {
    updateProfile.run(
      s.phone_number,
      s.country,
      s.state,
      s.city,
      s.lga,
      s.street_address,
      s.residential_location,
      s.workplace,
      s.biography ?? null,
      s.email
    );
  }

  db.prepare(`
    UPDATE announcements
    SET title = 'Annual Men’s Fellowship Retreat (Owerri) — Registration Now Open',
        content = 'Our annual weekend retreat convenes next month at the Glory Retreat Centre, New Owerri. Expect unhurried mornings in the Word, evening prayer sessions, shared meals, and practical teachings on fatherhood, godly stewardship, and marketplace leadership. Registration contribution is ₦50,000.00 (covers accommodation, meals, and study materials). Welfare support is available through the Men’s Executive.',
        updated_at = datetime('now')
    WHERE title = 'Annual Men’s Lakeside Retreat — Registration Now Open'
  `).run();

  db.prepare(`
    UPDATE announcements
    SET title = 'First Saturday Men’s Breakfast & Community Outreach (Owerri)',
        content = 'Join us at 7:30 AM (WAT) in the DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI Main Auditorium Annex for tea, breakfast, and an exhortation on practical brotherhood care. Afterward, teams will visit elder households across Owerri Municipal and Owerri North for home maintenance and welfare support.',
        updated_at = datetime('now')
    WHERE title = 'First Saturday Fellowship Breakfast & Service Morning'
  `).run();
}

function seedInitialFellowshipRecords() {
  const existingProfiles = db.prepare('SELECT COUNT(*) as cnt FROM profiles').get() as { cnt: number };
  if (existingProfiles.cnt > 0) return;

  const placeholderHash = hashPassword(crypto.randomBytes(24).toString('hex'));

  const seedMembers = [
    {
      id: crypto.randomUUID(),
      full_name: 'Chukwuemeka Nwosu',
      email: 'marcus.boateng@fellowship.example',
      phone_number: '+234 803 234 8910',
      profile_image: '/src/assets/images/avatar_member_1_1795267123139.jpg',
      date_of_birth: '1984-11-28',
      gender: 'Male',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri Municipal',
      street_address: '14 Okigwe Road, New Owerri',
      residential_location: 'New Owerri, Imo State, Nigeria',
      occupation: 'Civil & Structural Engineer',
      workplace: 'Imo Concorde Engineering Partners',
      professional_designation: 'Principal Structural Lead',
      skills: 'Project Management, Structural Design, Youth Mentorship',
      membership_category: 'Core Elders & Mentors',
      date_of_joining: '2019-03-14',
      fellowship_responsibilities: 'Men’s Breakfast Coordinator',
      biography: 'Serving in the fellowship for over seven years with a focus on mentoring young fathers and coordinating church infrastructure and community outreach across Owerri.',
      membership_status: 'approved',
      privacy: { phone: 'members', email: 'members', workplace: 'members', birthday: 'day_month', location: 'members' },
    },
    {
      id: crypto.randomUUID(),
      full_name: 'Dr. Ikenna Eze',
      email: 'rohan.kulkarni@fellowship.example',
      phone_number: '+234 806 391 4421',
      profile_image: '/src/assets/images/avatar_member_2_1795267122353.jpg',
      date_of_birth: '1990-12-04',
      gender: 'Male',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri North',
      street_address: '28 Egbu Road, Works Layout',
      residential_location: 'Works Layout, Owerri, Imo State, Nigeria',
      occupation: 'Healthcare Systems Analyst',
      workplace: 'Federal University Teaching Hospital, Owerri',
      professional_designation: 'Senior Clinical Data Architect',
      skills: 'Healthcare Operations, Data Analytics, Sound & AV Ministry',
      membership_category: 'Small Group Leader',
      date_of_joining: '2021-09-05',
      fellowship_responsibilities: 'Saturday Study Facilitator',
      biography: 'Passionate about bridging faith and daily vocation, leading our Thursday evening scripture and prayer cell in Owerri North.',
      membership_status: 'approved',
      privacy: { phone: 'admins_only', email: 'members', workplace: 'members', birthday: 'day_month', location: 'members' },
    },
    {
      id: crypto.randomUUID(),
      full_name: 'Elder Obinna Nwachukwu',
      email: 'arthur.pendelton@fellowship.example',
      phone_number: '+234 805 612 0084',
      profile_image: '/src/assets/images/avatar_member_3_1795267122255.jpg',
      date_of_birth: '1968-11-23',
      gender: 'Male',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Orlu',
      lga: 'Orlu',
      street_address: '7 Amaigbo Road',
      residential_location: 'Orlu, Imo State, Nigeria',
      occupation: 'Educator & Chaplaincy Advisor',
      workplace: 'Alvan Ikoku Educational Trust',
      professional_designation: 'Dean of Student Character',
      skills: 'Pastoral Care, Financial Stewardship, Conflict Mediation',
      membership_category: 'Senior Brotherhood',
      date_of_joining: '2015-01-18',
      fellowship_responsibilities: 'Welfare & Benevolence Lead',
      biography: 'Married 31 years with three grown sons. Available for marriage counsel, career guidance, and hospitality support across Imo State.',
      membership_status: 'approved',
      privacy: { phone: 'members', email: 'members', workplace: 'members', birthday: 'full_date', location: 'members' },
    },
    {
      id: crypto.randomUUID(),
      full_name: 'Tunde Adeyemi',
      email: 'daniel.tan@fellowship.example',
      phone_number: '+234 809 782 1953',
      profile_image: '/src/assets/images/avatar_member_4_1795267122410.jpg',
      date_of_birth: '1993-12-12',
      gender: 'Male',
      country: 'Nigeria',
      state: 'Rivers State',
      city: 'Port Harcourt',
      lga: 'Obio/Akpor',
      street_address: '19 Tombia Extension, GRA Phase 2',
      residential_location: 'Port Harcourt, Rivers State, Nigeria',
      occupation: 'Software Product Designer',
      workplace: 'Niger Delta Digital Studio',
      professional_designation: 'Lead UX Architect',
      skills: 'UI Design, Photography, Outreach Logistics',
      membership_category: 'Young Professionals',
      date_of_joining: '2023-05-20',
      fellowship_responsibilities: 'Communications & Media',
      biography: 'Tech lead grateful for a grounded brotherhood in Owerri and Port Harcourt. Enjoys community outreach, media ministry, and mentoring young graduates.',
      membership_status: 'approved',
      privacy: { phone: 'members', email: 'admins_only', workplace: 'members', birthday: 'day_month', location: 'admins_only' },
    },
    {
      id: crypto.randomUUID(),
      full_name: 'Samuel Okafor',
      email: 'samuel.okafor@fellowship.example',
      phone_number: '+234 813 844 3302',
      profile_image: null,
      date_of_birth: '1988-04-17',
      gender: 'Male',
      country: 'Nigeria',
      state: 'Imo State',
      city: 'Owerri',
      lga: 'Owerri West',
      street_address: '5 Nekede Exclusive Gardens',
      residential_location: 'Ihiagwa, Owerri West, Imo State, Nigeria',
      occupation: 'Chartered Accountant',
      workplace: 'Okafor & Nwosu Chartered Accountants',
      professional_designation: 'Managing Partner',
      skills: 'Tax Advisory, Nonprofit Accounting, Budgeting',
      membership_category: 'General Member',
      date_of_joining: '2026-11-18',
      fellowship_responsibilities: 'New Applicant',
      biography: 'Recently joined the Owerri congregation and eager to serve in Christian financial stewardship workshops and brotherhood welfare.',
      membership_status: 'pending',
      privacy: { phone: 'members', email: 'members', workplace: 'members', birthday: 'day_month', location: 'members' },
    },
  ];

  const insertUser = db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)');
  const insertProfile = db.prepare(`
    INSERT INTO profiles (
      id, full_name, email, phone_number, profile_image, date_of_birth, gender,
      country, state, city, lga, street_address, residential_location,
      occupation, workplace, professional_designation, skills,
      membership_category, date_of_joining, fellowship_responsibilities, biography, membership_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertRole = db.prepare('INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)');
  const insertPrivacy = db.prepare(`
    INSERT INTO profile_privacy (
      id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction(() => {
    for (const m of seedMembers) {
      insertUser.run(m.id, m.email, placeholderHash);
      insertProfile.run(
        m.id,
        m.full_name,
        m.email,
        m.phone_number,
        m.profile_image,
        m.date_of_birth,
        m.gender,
        m.country,
        m.state,
        m.city,
        m.lga,
        m.street_address,
        m.residential_location,
        m.occupation,
        m.workplace,
        m.professional_designation,
        m.skills,
        m.membership_category,
        m.date_of_joining,
        m.fellowship_responsibilities,
        m.biography,
        m.membership_status
      );
      insertRole.run(crypto.randomUUID(), m.id, 'member');
      insertPrivacy.run(
        crypto.randomUUID(),
        m.id,
        m.privacy.phone,
        m.privacy.email,
        m.privacy.workplace,
        m.privacy.birthday,
        m.privacy.location
      );
    }

    const authorId = seedMembers[0].id;
    db.prepare(`
      INSERT INTO announcements (id, title, content, image_url, is_pinned, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'Annual Men’s Fellowship Retreat (Owerri) — Registration Now Open',
      'Our annual weekend retreat convenes next month at the Glory Retreat Centre, New Owerri. Expect unhurried mornings in the Word, evening prayer sessions, shared meals, and practical teachings on fatherhood, godly stewardship, and marketplace leadership. Registration contribution is ₦50,000.00 (covers accommodation, meals, and study materials). Welfare support is available through the Men’s Executive.',
      '/src/assets/images/announcement_retreat_1795267122417.jpg',
      1,
      'published',
      authorId
    );

    db.prepare(`
      INSERT INTO announcements (id, title, content, image_url, is_pinned, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      'First Saturday Men’s Breakfast & Community Outreach (Owerri)',
      'Join us at 7:30 AM (WAT) in the DUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI Main Auditorium Annex for tea, breakfast, and an exhortation on practical brotherhood care. Afterward, teams will visit elder households across Owerri Municipal and Owerri North for home maintenance and welfare support.',
      null,
      0,
      'published',
      authorId
    );
  });

  tx();
}

export function logActivity(userId: string | null, action: string, details?: string) {
  db.prepare('INSERT INTO activity_logs (id, user_id, action, details) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    userId,
    action,
    details ?? null
  );
}
