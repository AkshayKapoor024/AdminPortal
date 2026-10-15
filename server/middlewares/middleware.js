// Express middleware functions used by the route files.
//
// The four "Validate" middlewares below all follow the same pattern:
// run the matching Joi schema against `req.body`, and either let the
// request continue (`next()`) or throw a 400 CustomError describing the
// first validation problem found.
import ValidateSignup from '../utils/ValidateSignup.js'
import ValidateLogin from '../utils/ValidateLogin.js'
import ValidateTask from '../utils/ValidateTask.js'
import ValidateLead from '../utils/ValidateLead.js'
import ValidateAnalytics from '../utils/ValidateAnalytics.js'
import customError from '../utils/customError.js'

/** Validates a signup (new user) request body before creating an account. */
export const SignupValidate = (req, res, next) => {
    const response = ValidateSignup.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a login request body before attempting authentication. */
export const LoginValidate = (req, res, next) => {
    const response = ValidateLogin.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a task request body before creating/updating a task. */
export const TaskValidate = (req, res, next) => {
    const response = ValidateTask.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates a lead request body before creating/updating a lead. */
export const LeadValidate = (req, res, next) => {
    const response = ValidateLead.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

/** Validates an analytics request (query or body) before processing. */
export const AnalyticsValidate = (req, res, next) => {
    const response = ValidateAnalytics.validate({ ...req.query, ...req.body })

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
export const isAuthenticated = async (
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
