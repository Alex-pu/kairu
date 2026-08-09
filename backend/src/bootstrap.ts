import bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { prisma } from './prisma';

/**
 * Ensures an admin account exists on startup so a fresh deployment is usable
 * immediately (the admin dashboard needs at least one admin to log in).
 *
 * - If SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD are set, that account is upserted
 *   to the ADMIN role (idempotent — safe to run on every boot).
 * - If no admin env is set and no admin exists yet, we only log a warning so the
 *   operator knows to create one; we never invent a default password in production.
 */
export async function ensureAdmin(): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (email && password) {
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.user.upsert({
      where: { email },
      update: { role: Role.ADMIN, passwordHash },
      create: { email, passwordHash, role: Role.ADMIN },
    });
    console.log(`Admin account ensured: ${email}`);
    return;
  }

  const adminCount = await prisma.user.count({ where: { role: Role.ADMIN } });
  if (adminCount === 0) {
    console.warn(
      'No admin account exists and SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD are not set. ' +
        'Set them (or run `npm run prisma:seed`) to enable the admin dashboard.'
    );
  }
}
