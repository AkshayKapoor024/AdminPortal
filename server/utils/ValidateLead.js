/**
 * Joi validation schema for a "Lead" record.
 *
 * Used by `middlewares/middleware.js` (`LeadValidate`) to check the
 * request body before a lead is created or updated, so bad/incomplete
 * data never reaches the database layer.
 *
 * NOTE:
 * - `userId` (the owner) is NEVER accepted from the client. It's read
 *   from `req.session.session_id` inside the controller.
 * - `clientId` is a plain string for now; will become a FK to `Client`
 *   once that model exists.
 */
import joi from 'joi'

export default new joi.object({
  id: joi.string().optional(),
  name: joi.string().required(),
  email: joi.string().email().required(),
  mobile: joi.string().required(),
  interested: joi.string().required(),
  lead_value: joi.string().required(),
  pan: joi.string().required(),
  status: joi.string().required(),
  source: joi.string().required(),
  nature: joi.string().required(),
  follow_up_date: joi.date().required(),
  reminder: joi.boolean().required(),
  description: joi.string().required(),
  documents: joi.array().items(joi.string()).optional(),

  // 👇 Client the lead is for. Optional until the Client table exists.
  clientId: joi.string().allow(null, '').optional(),

  // ❌ Removed: primary_user (was misused as the owner)
})