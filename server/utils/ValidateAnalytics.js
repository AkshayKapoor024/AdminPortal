import Joi from 'joi'

/**
 * Validation schema for analytics requests.
 * Analytics endpoints currently do not require mandatory body/query params,
 * but allows optional query filters (e.g. limit, format, periodId).
 */
const ValidateAnalytics = Joi.object({
    periodId: Joi.string().optional(),
    limit: Joi.number().integer().positive().optional(),
}).unknown(true)

export default ValidateAnalytics
