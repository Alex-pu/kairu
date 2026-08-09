import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

// Use the node-postgres driver adapter: queries run through `pg` rather than Prisma's
// bundled query engine. This is the recommended setup for serverless/edge and also keeps
// the connection handling in a single, well-understood driver.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });
