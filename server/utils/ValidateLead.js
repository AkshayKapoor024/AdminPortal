/**
 * Joi validation schema for a "Lead" record.
 *
 * Used by `middlewares/middleware.js` (`LeadValidate`) to check the
 * request body before a lead is created or updated, so bad/incomplete
 * data never reaches the database layer.
 */
const joi = require('joi')

module.exports = new joi.object({
    id:joi.string().optional(),
    name:joi.string().required(),
    email:joi.string().required(),
    mobile:joi.string().required(),
    interested:joi.string().required(),
    lead_value:joi.number().required(),
    pan:joi.string().required(),
    status:joi.string().required(),
    source:joi.string().required(),
    nature:joi.string().required(),
    follow_up_date:joi.date().required(),
    reminder:joi.boolean().required(),
    description:joi.string().required(),
    documents:joi.array().items(joi.string()).optional(),
    primary_user:joi.string().required()

})
