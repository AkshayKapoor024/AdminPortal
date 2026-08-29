// Express middleware functions used by the route files.
//
// The four "Validate" middlewares below all follow the same pattern:
// run the matching Joi schema against `req.body`, and either let the
// request continue (`next()`) or throw a 400 CustomError describing the
// first validation problem found.
const ValidateSignup = require('../utils/ValidateSignup')
const ValidateLogin = require('../utils/ValidateLogin')
const ValidateTask = require('../utils/ValidateTask.js')
const ValidateLead = require('../utils/ValidateLead.js')
const customError = require('../utils/customError.js')

/** Validates a signup (new user) request body before creating an account. */
module.exports.SignupValidate = (req, res, next) => {
    const response = ValidateSignup.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a login request body before attempting authentication. */
module.exports.LoginValidate = (req, res, next) => {
    const response = ValidateLogin.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a task request body before creating/updating a task. */
module.exports.TaskValidate = (req, res, next) => {
    const response = ValidateTask.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a lead request body before creating/updating a lead. */
module.exports.LeadValidate = (req, res, next) => {
    const response = ValidateLead.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/**
 * Guards routes that require a logged-in admin user.
 *
 * Checks for a `session_id` set on the Express session (created at login)
 * and rejects the request with 401 if it's missing.
 */
module.exports.isAuthenticated = async (
    req,
    res,
    next
) => {
    try {
        if (!req.session.session_id) {
            return res.status(401).json({
                message: "Authentication required",
            });
        }

        next();
    } catch (error) {
        res.status(500).json({
            message: "Authentication error",
        });
    }
};
