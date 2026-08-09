import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../prisma';
import { HttpError } from '../../common/middleware/error.middleware';

const SALT_ROUNDS = 12;

export async function register(email: string, password: string, fullName: string, phone: string) {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new HttpError(409, 'An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, passwordHash, fullName: fullName.trim(), phone: phone.trim() },
  });
  return issueToken(user.id, user.role);
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new HttpError(401, 'Invalid email or password');

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new HttpError(401, 'Invalid email or password');

  return issueToken(user.id, user.role);
}

function issueToken(userId: string, role: string) {
  const token = jwt.sign({ sub: userId, role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return { token };
}
