// Lead routes: create/update/list/fetch/delete a lead.
// `multer` handles any uploaded supporting documents before the request
// reaches validation and the controller.
// Dependencies 
import express from 'express'

const router = express.Router()

import wrapAsync from '../utils/wrapAsync.js'

import { isAuthenticated, LeadValidate } from '../middlewares/middleware.js';

import { create, update, getAll, getSingle, remove } from '../controllers/leads.js'

import multer from 'multer';

// multer setup
const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            cb(null, file.originalname)
        }
    })
})

/**
 * @openapi
 * /api/leads/create:
 *   post:
 *     summary: Create a new lead
 *     description: |
 *       Creates a lead owned by the logged-in user. Supports
 *       **multipart/form-data** file uploads via the `files` field
 *       (multer, disk storage). Uploaded filenames are stored in the
 *       `documents` array column.
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/LeadCreateRequest' }
 *           encoding:
 *             files: { style: form, explode: true }
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LeadCreateRequest' }
 *     responses:
 *       200:
 *         description: Lead created.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LeadSingleResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404:
 *         description: Logged-in user missing.
 *         content:
 *           application/json: { example: { error: "Logged-in user not found" } }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.post('/create', upload.array('files'), isAuthenticated, LeadValidate, wrapAsync(create))

/**
 * @openapi
 * /api/leads/update:
 *   patch:
 *     summary: Update an existing lead
 *     description: |
 *       Only the owner can update their lead. Newly uploaded files are
 *       **appended** to the existing `documents` array (not replaced).
 *     tags: [Leads]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema: { $ref: '#/components/schemas/LeadUpdateRequest' }
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LeadUpdateRequest' }
 *     responses:
 *       200:
 *         description: Lead updated.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LeadSingleResponse' }
 *       400:
 *         description: Lead ID not provided.
 *         content:
 *           application/json: { example: { error: "Lead ID not provided" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to edit this lead" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.patch('/update', upload.array('files'), isAuthenticated, LeadValidate, wrapAsync(update))

/**
 * @openapi
 * /api/leads/getLeads:
 *   get:
 *     summary: List leads owned by the logged-in user
 *     description: Ordered by `follow_up_date` ascending.
 *     tags: [Leads]
 *     responses:
 *       200:
 *         description: Lead list.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LeadListResponse' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/getLeads', isAuthenticated, wrapAsync(getAll))

/**
 * @openapi
 * /api/leads/lead/{leadId}:
 *   get:
 *     summary: Fetch a single lead by ID
 *     tags: [Leads]
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead fetched.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/LeadSingleResponse' }
 *       400:
 *         description: Lead ID missing.
 *         content:
 *           application/json: { example: { error: "Lead Id not provided" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to view this lead" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/lead/:leadId', isAuthenticated, wrapAsync(getSingle))

/**
 * @openapi
 * /api/leads/delete/{leadId}:
 *   delete:
 *     summary: Delete a lead
 *     tags: [Leads]
 *     parameters:
 *       - in: path
 *         name: leadId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Lead deleted.
 *         content:
 *           application/json: { example: { message: "Successfully deleted lead" } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403:
 *         description: Not the owner.
 *         content:
 *           application/json: { example: { error: "Not allowed to delete this lead" } }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.delete('/delete/:leadId', isAuthenticated, wrapAsync(remove))

export default router