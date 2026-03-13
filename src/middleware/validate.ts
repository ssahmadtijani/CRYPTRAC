/**
 * Generic Zod Validation Middleware for CRYPTRAC
 *
 * Returns an Express middleware that validates the specified part of the
 * request against the given Zod schema.
 *
 * On validation failure it responds with HTTP 400 and a structured list of
 * field-level errors.  On success the validated (coerced) value is written
 * back to `req[target]` so downstream handlers receive the cleaned data.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationTarget = 'body' | 'query' | 'params';

export const validate = (schema: ZodSchema, target: ValidationTarget = 'body') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const errors = formatZodErrors(result.error);

      res.status(400).json({
        success: false,
        error: {
          message: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors,
        },
      });
      return;
    }

    // Replace the request property with the validated (and potentially
    // coerced / defaulted) value from Zod.
    (req as unknown as Record<string, unknown>)[target] = result.data;
    next();
  };
};

/**
 * Converts a ZodError into a flat, human-readable list of field errors.
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  }));
}
