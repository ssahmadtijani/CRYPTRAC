import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, UserRole } from '../types';
import { RegisterInput } from '../validators/schemas';

const SALT_ROUNDS = 10;
const users: User[] = [];

export const authService = {
  async register(input: RegisterInput): Promise<Omit<User, 'passwordHash'>> {
    const existing = users.find(
      (u) => u.email.toLowerCase() === input.email.toLowerCase()
    );
    if (existing) {
      const err = new Error('Email already registered') as Error & { statusCode: number };
      err.statusCode = 409;
      throw err;
    }

    const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
    const now = new Date();

    const user: User = {
      id: uuidv4(),
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role ?? UserRole.USER,
      firstName: input.firstName,
      lastName: input.lastName,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    };

    users.push(user);
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },

  async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: Omit<User, 'passwordHash'> }> {
    const user = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
    if (!user) {
      const err = new Error('Invalid email or password') as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const err = new Error('Invalid email or password') as Error & { statusCode: number };
      err.statusCode = 401;
      throw err;
    }

    if (!user.isActive) {
      const err = new Error('Account is deactivated') as Error & { statusCode: number };
      err.statusCode = 403;
      throw err;
    }

    const token = this.generateToken(user);
    const { passwordHash: _, ...safeUser } = user;
    return { token, user: safeUser };
  },

  generateToken(user: User): string {
    const secret = process.env.JWT_SECRET || 'default-dev-secret';
    const expiresIn = process.env.JWT_EXPIRES_IN || '24h';
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      secret,
      { expiresIn } as jwt.SignOptions
    );
  },

  getUserById(id: string): Omit<User, 'passwordHash'> | undefined {
    const user = users.find((u) => u.id === id);
    if (!user) return undefined;
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  },
};
