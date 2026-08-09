import bcrypt from 'bcryptjs';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/**
 * Seeds a first admin plus two demo users so the app is usable immediately.
 * Idempotent: re-running only updates the seeded accounts, never duplicates them.
 * Passwords come from env (falling back to demo defaults) — override in real deployments.
 */
async function main() {
  const accounts: Array<{ email: string; password: string; role: Role; fullName: string; phone: string }> = [
    { email: process.env.SEED_ADMIN_EMAIL || 'admin@safepay.test', password: process.env.SEED_ADMIN_PASSWORD || 'admin12345', role: Role.ADMIN, fullName: 'Platform Admin', phone: '254700000000' },
    { email: 'buyer@safepay.test', password: 'buyer12345', role: Role.USER, fullName: 'Demo Buyer', phone: '254711111111' },
    { email: 'seller@safepay.test', password: 'seller12345', role: Role.USER, fullName: 'Demo Seller', phone: '254722222222' },
  ];

  for (const a of accounts) {
    const passwordHash = await bcrypt.hash(a.password, 12);
    await prisma.user.upsert({
      where: { email: a.email },
      update: { role: a.role, passwordHash, fullName: a.fullName, phone: a.phone },
      create: { email: a.email, passwordHash, role: a.role, fullName: a.fullName, phone: a.phone },
    });
    console.log(`  ✓ ${a.role.padEnd(5)} ${a.email}  (password: ${a.password})`);
  }
  console.log('\nSeed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
