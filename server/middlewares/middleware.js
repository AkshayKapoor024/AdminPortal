const ValidateSignup = require('../utils/ValidateSignup')
const ValidateLogin = require('../utils/ValidateLogin')
const ValidateTask = require('../utils/ValidateTask.js')
const ValidateLead = require('../utils/ValidateLead.js')
const customError = require('../utils/customError.js')

module.exports.SignupValidate = (req, res, next) => {
    const response = ValidateSignup.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

module.exports.LoginValidate = (req, res, next) => {
    const response = ValidateLogin.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

module.exports.TaskValidate = (req, res, next) => {
    const response = ValidateTask.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

module.exports.LeadValidate = (req, res, next) => {
    const response = ValidateLead.validate(req.body)

    if (response.error) {
        throw new customError(400, response.error.details[0].message)
    } else {
        next()
    }
}

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

