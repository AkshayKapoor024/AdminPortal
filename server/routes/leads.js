// Lead routes: create/update/list/fetch/delete a lead.
// `multer` handles any uploaded supporting documents before the request
// reaches validation and the controller.
// Dependencies 
const express = require('express')

const router = express.Router()

const wrapAsync = require('../utils/wrapAsync')

const { isAuthenticated, LeadValidate } = require('../middlewares/middleware')

const { create, update, getAll, getSingle, remove } = require('../controllers/leads')

const multer = require('multer')

// multer setup
const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            cb(null, file.originalname)
        }
    })
})

router.post('/create', upload.array('files'), isAuthenticated, LeadValidate, wrapAsync(create))

router.patch('/update', upload.array('files'), isAuthenticated, LeadValidate, wrapAsync(update))

router.get('/getLeads', isAuthenticated, wrapAsync(getAll))

router.get('/lead/:leadId', isAuthenticated, wrapAsync(getSingle))

router.delete('/delete/:leadId', isAuthenticated, wrapAsync(remove))

module.exports = router