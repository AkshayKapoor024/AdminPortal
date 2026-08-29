// Task routes: create/update/list/fetch/delete a task.
// Dependencies 
const express = require('express')

const router = express.Router()

const wrapAsync = require('../utils/wrapAsync')

const { isAuthenticated, LeadValidate } = require('../middlewares/middleware')

const { create, update, getAll, getSingle, remove } = require('../controllers/tasks')

router.post('/create', isAuthenticated, TaskValidate, wrapAsync(create))

router.patch('/update', isAuthenticated, TaskValidate, wrapAsync(update))

router.get('/getTasks', isAuthenticated, wrapAsync(getAll))

router.get('/task/:taskId', isAuthenticated, wrapAsync(getSingle))

router.delete('/delete/:taskId', isAuthenticated, wrapAsync(remove))

module.exports = router