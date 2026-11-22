import crypto from 'crypto';
import dotenv from 'dotenv';
import readline from 'readline';
import { db, initDatabase, logActivity } from '../server/db.ts';
import { hashPassword, isValidEmail, normalizePhoneNumber } from '../server/security.ts';

dotenv.config();
initDatabase();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function run() {
  console.log("\nDUNAMIS INTERNATIONAL GOSPEL CENTRE, OWERRI — Men's Fellowship Administrator Utility\n");

  const fullName = await ask('Administrator Full Name: ');
  const emailInput = await ask('Administrator Email: ');
  const rawPhone = (await ask('Phone Number (+234 optional, press Enter for default): ')) || '+234 800 000 0100';
  const phone = normalizePhoneNumber(rawPhone);
  const password = await ask('Password (min 8 characters): ');

  const email = emailInput.toLowerCase();
  if (fullName.length < 2 || !isValidEmail(email) || password.length < 8) {
    console.error('\nError: Valid full name, email address, and password (>= 8 chars) are required.');
    rl.close();
    process.exit(1);
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
  if (existing) {
    db.prepare(`UPDATE user_roles SET role = 'admin' WHERE user_id = ?`).run(existing.id);
    db.prepare(`UPDATE profiles SET membership_status = 'approved', updated_at = datetime('now') WHERE id = ?`).run(
      existing.id
    );
    logActivity(existing.id, 'admin_promoted_via_cli', `Promoted ${email} via CLI`);
    console.log(`\nExisting user ${email} has been promoted to Administrator and approved.\n`);
    rl.close();
    return;
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)').run(userId, email, passwordHash);
    db.prepare(
      `INSERT INTO profiles (
        id, full_name, email, phone_number, country, state, city, residential_location,
        occupation, professional_designation, fellowship_responsibilities,
        membership_category, membership_status, date_of_joining
      ) VALUES (?, ?, ?, ?, 'Nigeria', 'Imo State', 'Owerri', 'Owerri, Imo State, Nigeria', 'Fellowship Leadership', 'Portal Administrator', 'Administration', 'Leadership', 'approved', date('now'))`
    ).run(userId, fullName, email, phone);
    db.prepare(`INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, 'admin')`).run(crypto.randomUUID(), userId);
    db.prepare(
      `INSERT INTO profile_privacy (
        id, user_id, phone_visibility, email_visibility, workplace_visibility, birthday_visibility, location_visibility
      ) VALUES (?, ?, 'admins_only', 'members', 'members', 'day_month', 'members')`
    ).run(crypto.randomUUID(), userId);
    logActivity(userId, 'admin_created_via_cli', `Created initial administrator ${email}`);
  });

  tx();
  console.log(`\nAdministrator account created successfully for ${email}.\n`);
  rl.close();
}

run().catch((err) => {
  console.error(err);
  rl.close();
  process.exit(1);
});
