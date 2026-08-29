/**
 * Joi validation schema for a login request.
 *
 * Used by `middlewares/middleware.js` (`LoginValidate`) to make sure an
 * email and password were both provided before attempting to authenticate.
 */
const joi = require('joi')

module.exports = new joi.object({
    email:joi.string().required(),
    password:joi.string().required(),
})
