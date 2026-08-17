const joi = require('joi')

module.exports = new joi.object({
    email:joi.string().required(),
    password:joi.string().required(),
})