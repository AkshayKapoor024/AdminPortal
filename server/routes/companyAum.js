// Company AUM routes: import company WBR22 holdings files, matched
// against the BSE master scheme list, into the company_aum table.
import express from 'express'

const router = express.Router();

import multer from 'multer';

import wrapAsync from '../utils/wrapAsync.js';
import { isAuthenticated } from "../middlewares/middleware.js";
import { importCompanyAum } from "../controllers/companyAum.js";

// WBR22 uploads are only needed transiently for parsing (unlike lead/task
// document uploads, which are meant to be kept), so they're read straight
// into memory and never written to disk.
const upload = multer({ storage: multer.memoryStorage() });

/**
 * @openapi
 * /api/company-aum/import:
 *   post:
 *     summary: Import WBR22 files for company AUM ingestion
 *     description: |
 *       Accepts one or more WBR22 files (CAMS or Karvy format) plus a
 *       `quarterDate` ISO string identifying the reporting quarter.
 *
 *       Files are read into memory (never written to disk), parsed, matched
 *       against the BSE master scheme list, and persisted to the
 *       `company_aum` table.
 *
 *       **Idempotency:** Files are deduplicated by content hash
 *       (`CompanyAumFileImport.fileHash`). Re-uploading the same file is
 *       safely skipped.
 *
 *       **Update semantics (per fund, per quarter):**
 *       - Same calendar day + same quarter → **add** to today's running total
 *       - New day + same quarter → **overwrite** with today's fresh total
 *       - New quarter → **create** a new row; previous quarter preserved
 *     tags: [Company AUM]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [files, quarterDate]
 *             properties:
 *               files:
 *                 type: array
 *                 items: { type: string, format: binary }
 *                 description: One or more WBR22 files. Field name **must** be `files`.
 *               quarterDate:
 *                 type: string
 *                 format: date
 *                 example: "2025-09-30"
 *                 description: ISO date identifying the reporting quarter.
 *           encoding:
 *             files: { style: form, explode: true }
 *     responses:
 *       200:
 *         description: Import completed.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CompanyAumImportResult' }
 *             example:
 *               message: "Company AUM imported successfully"
 *               period: { id: "0192b3c4-...", financialYear: "2025-26", quarter: 2, periodStart: "2025-07-01", periodEnd: "2025-09-30" }
 *               matchedSchemeCount: 128
 *               unmatchedSchemeCount: 6
 *               totalClosingAssets: 84512003.45
 *       400:
 *         description: Missing files or missing quarterDate.
 *         content:
 *           application/json:
 *             examples:
 *               noFiles: { value: { status: 400, message: 'At least one WBR22 file is required (field name "files")' } }
 *               noDate:  { value: { status: 400, message: "quarterDate (an ISO date string) is required to identify the reporting quarter" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.post("/import", isAuthenticated, upload.array("files"), wrapAsync(importCompanyAum));

export default router
