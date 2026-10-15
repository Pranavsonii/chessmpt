import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { createDb, createPool, Database } from './client';
import { loadEnv, requireDatabaseUrl } from './load-env';
import { NewTournament, tournaments, users, UserRole } from './schema';

/** Seed credentials. These are documented in the README. */
export const SEED_PASSWORDS = { coach: 'Coach@123', student: 'Student@123' };

const SEED_USERS: { email: string; name: string; role: UserRole }[] = [
  { email: 'coach@koc.test', name: 'Coach Ramesh', role: 'coach' },
  { email: 'aarav@koc.test', name: 'Aarav Sharma', role: 'student' },
  { email: 'diya@koc.test', name: 'Diya Patel', role: 'student' },
  { email: 'vihaan@koc.test', name: 'Vihaan Reddy', role: 'student' },
  { email: 'ananya@koc.test', name: 'Ananya Iyer', role: 'student' },
  { email: 'arjun@koc.test', name: 'Arjun Nair', role: 'student' },
  { email: 'ishaan@koc.test', name: 'Ishaan Gupta', role: 'student' },
];

const BCRYPT_COST = 10;

async function upsertUsers(db: Database) {
  const [coachHash, studentHash] = await Promise.all([
    bcrypt.hash(SEED_PASSWORDS.coach, BCRYPT_COST),
    bcrypt.hash(SEED_PASSWORDS.student, BCRYPT_COST),
  ]);

  for (const u of SEED_USERS) {
    const passwordHash = u.role === 'coach' ? coachHash : studentHash;
    await db
      .insert(users)
      .values({ ...u, passwordHash })
      // Idempotent: re-running the seed resets name/role/password instead of failing.
      .onConflictDoUpdate({
        target: users.email,
        set: { name: u.name, role: u.role, passwordHash },
      });
  }
}

/** Tomorrow at the given IST hour, as a UTC instant. */
function tomorrowIst(hour: number): Date {
  const IST_OFFSET_MIN = 330;
  const nowIst = new Date(Date.now() + IST_OFFSET_MIN * 60_000);
  const d = new Date(
    Date.UTC(
      nowIst.getUTCFullYear(),
      nowIst.getUTCMonth(),
      nowIst.getUTCDate() + 1,
      hour,
    ),
  );
  return new Date(d.getTime() - IST_OFFSET_MIN * 60_000);
}

async function seedTournaments(db: Database) {
  const coach = await db.query.users.findFirst({
    where: eq(users.email, 'coach@koc.test'),
  });
  if (!coach) throw new Error('Coach was not seeded');

  const seed: Omit<NewTournament, 'createdById'>[] = [
    {
      name: 'Diwali Blitz Cup',
      initialSeconds: 300,
      incrementSeconds: 0,
      startsAt: tomorrowIst(17),
      status: 'open',
    },
    {
      name: 'Bullet Practice (1+0)',
      initialSeconds: 60,
      incrementSeconds: 0,
      startsAt: tomorrowIst(18),
      status: 'open',
    },
    {
      name: 'Weekend Rapid',
      initialSeconds: 600,
      incrementSeconds: 5,
      startsAt: tomorrowIst(10),
      status: 'draft',
    },
  ];

  for (const t of seed) {
    // Idempotent: tournaments have no natural unique key, so insert only if missing.
    const existing = await db.query.tournaments.findFirst({
      where: and(
        eq(tournaments.name, t.name),
        eq(tournaments.createdById, coach.id),
      ),
    });
    if (!existing) {
      await db.insert(tournaments).values({ ...t, createdById: coach.id });
    }
  }
}

async function main() {
  loadEnv();
  const pool = createPool(requireDatabaseUrl());
  const db = createDb(pool);
  try {
    await upsertUsers(db);
    await seedTournaments(db);
    console.log('✔ Seeded users:');
    for (const u of SEED_USERS) {
      console.log(
        `   ${u.role.padEnd(7)} ${u.email.padEnd(18)} ${SEED_PASSWORDS[u.role]}`,
      );
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('✖ Seed failed:', err);
  process.exit(1);
});
