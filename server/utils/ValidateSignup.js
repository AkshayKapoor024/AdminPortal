/**
 * Joi validation schema for a signup (new admin user) request.
 *
 * Used by `middlewares/middleware.js` (`SignupValidate`) to check the
 * request body before a new user account is created.
 */
import joi from 'joi'

export default new joi.object({
    name:joi.string().required(),
    username:joi.string().required(),
    email:joi.string().required(),
    password:joi.string().required(),
    role:joi.string().required()
})
