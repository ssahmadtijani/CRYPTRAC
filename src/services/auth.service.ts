/**
 * Auth Service for CRYPTRAC
 * Handles user registration, login, and JWT token management
 */

import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../types';
import { RegisterInput, LoginInput } from '../validators/schemas';
import { JwtPayload } from '../middleware/auth';
import { logger } from '../utils/logger';
import { prisma } from '../lib/prisma';

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Maps a Prisma User record to the application User type.
 */
function mapPrismaUser(u: {
  id: string;
  email: string;
  passwordHash: string;
  role: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): User {
  return {
    id: u.id,
    email: u.email,
    passwordHash: u.passwordHash,
    firstName: u.firstName ?? '',
    lastName: u.lastName ?? '',
    role: u.role as UserRole,
    isActive: u.isActive,
    lastLogin: u.lastLogin ?? undefined,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

/**
 * Registers a new user with a bcrypt-hashed password.
 */
export async function register(
  data: RegisterInput
): Promise<Omit<User, 'passwordHash'>> {
  const existing = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });
  if (existing) {
    const err = new Error('A user with this email already exists') as Error & {
      statusCode: number;
    };
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const created = await prisma.user.create({
    data: {
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      role: (data.role ?? UserRole.USER) as Prisma.UserCreateInput['role'],
    },
  });

  const user = mapPrismaUser(created);
  logger.info('User registered', { userId: user.id, email: user.email });

  const { passwordHash: _ph, ...safeUser } = user;
  return safeUser;
}

/**
 * Authenticates a user and returns a JWT token.
 */
export async function login(
  data: LoginInput
): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
  const found = await prisma.user.findUnique({
    where: { email: data.email.toLowerCase() },
  });

  if (!found) {
    const err = new Error('Invalid email or password') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  if (!found.isActive) {
    const err = new Error('Account is deactivated') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  const isValid = await bcrypt.compare(data.password, found.passwordHash);
  if (!isValid) {
    const err = new Error('Invalid email or password') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  const updated = await prisma.user.update({
    where: { id: found.id },
    data: { lastLogin: new Date() },
  });

  const user = mapPrismaUser(updated);
  const token = generateToken(user);

  logger.info('User logged in', { userId: user.id, email: user.email });

  const { passwordHash: _ph, ...safeUser } = user;
  return { token, user: safeUser };
}

/**
 * Generates a signed JWT token for a user.
 */
export function generateToken(user: User): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return jwt.sign(payload, secret, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

/**
 * Verifies and decodes a JWT token.
 */
export function verifyToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.verify(token, secret) as JwtPayload;
}

/**
 * Retrieves a user by ID (without password hash).
 */
export async function getUserById(
  id: string
): Promise<Omit<User, 'passwordHash'> | null> {
  const found = await prisma.user.findUnique({ where: { id } });
  if (!found) return null;
  const user = mapPrismaUser(found);
  const { passwordHash: _ph, ...safeUser } = user;
  return safeUser;
}

/**
 * Returns all users (without password hashes).
 */
export async function getAllUsers(): Promise<Omit<User, 'passwordHash'>[]> {
  const users = await prisma.user.findMany();
  return users.map((u) => {
    const mapped = mapPrismaUser(u);
    const { passwordHash: _ph, ...safeUser } = mapped;
    return safeUser;
  });
}

