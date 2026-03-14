/**
 * XML Exchange Report Import Routes for CRYPTRAC
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { apiRateLimiter } from '../middleware/rateLimiter';
import * as xmlImportService from '../services/xml-import.service';
import { UserRole, ApiResponse } from '../types';

export const xmlImportRoutes = Router();

xmlImportRoutes.use(apiRateLimiter);

/**
 * POST /api/v1/exchange-reports/validate
 * Validate an XML report without importing it.
 */
xmlImportRoutes.post(
  '/validate',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const xmlContent = extractXmlContent(req);
      if (!xmlContent) {
        res.status(400).json({
          success: false,
          error: { message: 'XML content required in request body (field: xml or raw body)' },
        });
        return;
      }

      const result = xmlImportService.validateExchangeReport(xmlContent);
      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/v1/exchange-reports/import
 * Validate and import an XML exchange report.
 */
xmlImportRoutes.post(
  '/import',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const xmlContent = extractXmlContent(req);
      if (!xmlContent) {
        res.status(400).json({
          success: false,
          error: { message: 'XML content required in request body (field: xml or raw body)' },
        });
        return;
      }

      const submittedBy = req.user?.userId;
      const result = await xmlImportService.importExchangeReport(
        xmlContent,
        submittedBy
      );

      const httpStatus = result.status === 'FAILED' ? 422 : 201;
      const response: ApiResponse<typeof result> = {
        success: result.status !== 'FAILED',
        data: result,
      };
      res.status(httpStatus).json(response);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/exchange-reports
 * List all import submissions (most recent first).
 */
xmlImportRoutes.get(
  '/',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

      const result = await xmlImportService.getImportHistory(page, pageSize);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: {
          page: result.page,
          pageSize: result.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / result.pageSize),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/v1/exchange-reports/:id
 * Get details of a specific import submission.
 */
xmlImportRoutes.get(
  '/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.COMPLIANCE_OFFICER, UserRole.AUDITOR),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = await xmlImportService.getImportById(req.params.id as string);

      if (!record) {
        res.status(404).json({
          success: false,
          error: { message: 'Import submission not found' },
        });
        return;
      }

      const response: ApiResponse<typeof record> = {
        success: true,
        data: record,
      };
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  }
);

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

/**
 * Extracts XML content from the request.
 * Accepts either:
 *   - `req.body.xml` (string field in a JSON body)
 *   - The raw text body when Content-Type is application/xml or text/xml
 */
function extractXmlContent(req: Request): string | null {
  if (req.body && typeof req.body === 'object' && typeof req.body.xml === 'string') {
    return req.body.xml;
  }
  if (typeof req.body === 'string' && req.body.trim().startsWith('<')) {
    return req.body;
  }
  return null;
}
