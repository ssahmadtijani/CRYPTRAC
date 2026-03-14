/**
 * Auth Service for CRYPTRAC
 * Handles user registration, login, and JWT token management
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../types';
import { RegisterInput, LoginInput } from '../validators/schemas';
import { JwtPayload } from '../middleware/auth';
import { logger } from '../utils/logger';

// In-memory user store (replace with Prisma in production)
const users: Map<string, User> = new Map();
const usersByEmail: Map<string, User> = new Map();

const BCRYPT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY || '24h';

/**
 * Registers a new user with a bcrypt-hashed password.
 */
export async function register(
  data: RegisterInput
): Promise<Omit<User, 'passwordHash'>> {
  if (usersByEmail.has(data.email.toLowerCase())) {
    const err = new Error('A user with this email already exists') as Error & {
      statusCode: number;
    };
    err.statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  const now = new Date();
  const user: User = {
    id: uuidv4(),
    email: data.email.toLowerCase(),
    passwordHash,
    firstName: data.firstName,
    lastName: data.lastName,
    role: data.role ?? UserRole.USER,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  users.set(user.id, user);
  usersByEmail.set(user.email, user);

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
  const user = usersByEmail.get(data.email.toLowerCase());

  if (!user) {
    const err = new Error('Invalid email or password') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  if (!user.isActive) {
    const err = new Error('Account is deactivated') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  const isValid = await bcrypt.compare(data.password, user.passwordHash);
  if (!isValid) {
    const err = new Error('Invalid email or password') as Error & {
      statusCode: number;
    };
    err.statusCode = 401;
    throw err;
  }

  user.lastLogin = new Date();
  user.updatedAt = new Date();

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
export function getUserById(id: string): Omit<User, 'passwordHash'> | null {
  const user = users.get(id);
  if (!user) return null;
  const { passwordHash: _ph, ...safeUser } = user;
  return safeUser;
}

/**
 * Returns all users (without password hashes).
 */
export function getAllUsers(): Omit<User, 'passwordHash'>[] {
  return Array.from(users.values()).map(({ passwordHash: _ph, ...u }) => u);
}

/**
 * Injects a pre-built user directly (used by demo seeder).
 */
export function injectUser(user: User): void {
  users.set(user.id, user);
  usersByEmail.set(user.email, user);
}
