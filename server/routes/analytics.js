// Analytics routes: business analytics endpoints for AMC and Category performance.
import express from 'express'
const router = express.Router();

import wrapAsync from '../utils/wrapAsync.js';
import { isAuthenticated, AnalyticsValidate } from "../middlewares/middleware.js";
import { getPerformanceAmc, getPerformanceCategory } from "../controllers/analytics.js";

// ============================================================================
// AMC PERFORMANCE  —  /api/analytics/performance_amc
// ============================================================================

/**
 * @openapi
 * /api/analytics/performance_amc:
 *   get:
 *     summary: AMC-wise AUM and AAUM performance
 *     description: |
 *       Returns total AUM and AAUM grouped by **AMC** for the latest
 *       available quarter. "Latest available" means: if the current
 *       financial quarter has CompanyAum records, use it; otherwise fall
 *       back to the most recent quarter that does.
 *
 *       If no data exists at all, returns `period: null` and `data: []`
 *       with a 200 status (not a 404).
 *     tags: [Analytics]
 *     parameters:
 *       - in: query
 *         name: financialYear
 *         required: false
 *         schema: { type: string }
 *         description: Optional override (currently ignored; period is auto-detected).
 *         example: "2025-26"
 *       - in: query
 *         name: quarter
 *         required: false
 *         schema: { type: integer, enum: [1, 2, 3, 4] }
 *         description: Optional override (currently ignored; period is auto-detected).
 *     responses:
 *       200:
 *         description: AMC performance data.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AmcPerformanceResponse' }
 *             examples:
 *               withData:
 *                 value:
 *                   message: "Successfully fetched AMC performance analytics"
 *                   period: { id: "0192b3c4-...", financialYear: "2025-26", quarter: 2, periodStart: "2025-07-01", periodEnd: "2025-09-30" }
 *                   data:
 *                     - { amc: "HDFCMutualFund_MF", amcCode: "HDFCMutualFund_MF", aum: 366045.486, aaum: 405314.494 }
 *                     - { amc: "ICICIMutualFund_MF", amcCode: "ICICIMutualFund_MF", aum: 298110.201, aaum: 312005.110 }
 *               noData:
 *                 value: { message: "Successfully fetched AMC performance analytics", period: null, data: [] }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 *   post:
 *     summary: AMC-wise AUM and AAUM performance (POST variant)
 *     description: |
 *       Identical behavior to the GET variant. Use POST if your client
 *       needs a body-based request (e.g. to avoid URL length limits or
 *       to align with an existing client contract).
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: AMC performance data.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AmcPerformanceResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get("/performance_amc", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceAmc));
router.post("/performance_amc", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceAmc));

// ============================================================================
// CATEGORY PERFORMANCE  —  /api/analytics/performance_category
// ============================================================================

/**
 * @openapi
 * /api/analytics/performance_category:
 *   get:
 *     summary: Category-wise AUM and AAUM performance
 *     description: |
 *       Returns total AUM and AAUM grouped by **Category** for the latest
 *       available quarter, resolved using the same fallback logic as the
 *       AMC endpoint.
 *
 *       Each row includes both `catagory` (legacy misspelling, kept for
 *       frontend compatibility) and `category` (correct spelling).
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Category performance data.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CategoryPerformanceResponse' }
 *             examples:
 *               withData:
 *                 value:
 *                   message: "Successfully fetched category performance analytics"
 *                   period: { id: "0192b3c4-...", financialYear: "2025-26", quarter: 2, periodStart: "2025-07-01", periodEnd: "2025-09-30" }
 *                   data:
 *                     - { catagory: "Large Cap Fund", category: "Large Cap Fund", categoryCode: "LC", categoryId: "0192b3c4-...", aum: 366045.486, aaum: 405314.494 }
 *               noData:
 *                 value: { message: "Successfully fetched category performance analytics", period: null, data: [] }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 *   post:
 *     summary: Category-wise AUM and AAUM performance (POST variant)
 *     description: |
 *       Identical behavior to the GET variant. Use POST if your client
 *       needs a body-based request.
 *     tags: [Analytics]
 *     responses:
 *       200:
 *         description: Category performance data.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/CategoryPerformanceResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */
router.get("/performance_category", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));
router.post("/performance_category", isAuthenticated, AnalyticsValidate, wrapAsync(getPerformanceCategory));

export default router