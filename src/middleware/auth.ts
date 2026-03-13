/**
 * Authentication Middleware for CRYPTRAC
 * JWT token verification and role-based authorization
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

// Extend Express Request type to include user payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

/**
 * Middleware that verifies a JWT Bearer token from the Authorization header.
 * Attaches the decoded payload to `req.user`.
 */
export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: { message: 'Authentication required. Provide a Bearer token.' },
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const decoded = jwt.verify(token, secret) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    logger.warn('JWT verification failed', { error });

    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        error: { message: 'Token has expired. Please log in again.' },
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: { message: 'Invalid token.' },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { message: 'Authentication error.' },
    });
  }
};

/**
 * Middleware factory that restricts access to users with one of the given roles.
 * Must be used after `authenticate`.
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { message: 'Authentication required.' },
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Unauthorized access attempt', {
        userId: req.user.userId,
        role: req.user.role,
        requiredRoles: roles,
        path: req.path,
      });

      res.status(403).json({
        success: false,
        error: {
          message: 'Insufficient permissions to access this resource.',
          code: 'FORBIDDEN',
        },
      });
      return;
    }

    next();
  };
};
