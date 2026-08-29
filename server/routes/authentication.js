// Authentication routes: signup, login, logout, and user lookups.
// Each route runs its Joi validation middleware (where applicable) and
// `isAuthenticated` (where the route requires a logged-in session)
// before reaching the controller, via `wrapAsync` so any thrown/rejected
// error is forwarded to Express's error handler.
// Dependencies 
const express = require('express')

const router = express.Router()

const wrapAsync = require('../utils/wrapAsync')

const { LoginValidate, SignupValidate , isAuthenticated } = require('./middlewares/middleware')

const { login, signup, getSingleUser, getUsers, logout } = require('../controllers/authentication')

router.post('/signup',SignupValidate,wrapAsync(signup))

router.post('/login',LoginValidate,wrapAsync(login))

router.get('/getUsers',isAuthenticated,wrapAsync(getUsers))

router.get('/getUser/:id',isAuthenticated,wrapAsync(getSingleUser))

router.get('/logout',isAuthenticated,logout)

module.exports = router