const joi = require('joi')

module.exports = new joi.object({
    name:joi.string().required(),
    username:joi.string().required(),
    email:joi.string().required(),
    password:joi.string().required(),
    role:joi.string().required()
})