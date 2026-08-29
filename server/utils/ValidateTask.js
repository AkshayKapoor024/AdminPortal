/**
 * Joi validation schema for a "Task" record.
 *
 * Used by `middlewares/middleware.js` (`TaskValidate`) to check the
 * request body before a task is created or updated.
 */
const joi = require('joi')

module.exports = new joi.object({
    id:joi.string().optional(),
    title:joi.string().required(),
    description:joi.string().required(),
    clientId:joi.string().required(),
    category:joi.string().required(),
    priority:joi.string().required(),
    dueDate:joi.date().required(),
    status:joi.string().required()
})
