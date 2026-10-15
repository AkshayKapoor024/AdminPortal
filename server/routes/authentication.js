// Authentication routes: signup, login, logout, and user lookups.
// Each route runs its Joi validation middleware (where applicable) and
// `isAuthenticated` (where the route requires a logged-in session)
// before reaching the controller, via `wrapAsync` so any thrown/rejected
// error is forwarded to Express's error handler.
// Dependencies 
import express from 'express'

const router = express.Router()

import wrapAsync from '../utils/wrapAsync.js'

import { LoginValidate, SignupValidate , isAuthenticated } from '../middlewares/middleware.js';

import { login, signup, getSingleUser, getUsers, logout  , isAuthenticatedController} from '../controllers/authentication.js';


/**
 * @openapi
 * /api/auth/signup:
 *   post:
 *     summary: Register a new admin user
 *     description: |
 *       Creates a new admin user, hashes the password with bcrypt (cost 12),
 *       and **auto-logs the user in** by setting a session cookie (`connect.sid`).
 *
 *       After this call succeeds, the browser holds a valid session — all
 *       protected endpoints can be called immediately without a separate login.
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SignupRequest' }
 *           example:
 *             name: "Akshay Kapoor"
 *             username: "akshay"
 *             email: "akshay@dkwealth.com"
 *             password: "StrongPass@123"
 *             role: "admin"
 *     responses:
 *       200:
 *         description: Signup successful; user is now logged in.
 *         headers:
 *           Set-Cookie:
 *             description: Session cookie (`connect.sid`) is set.
 *             schema: { type: string, example: "connect.sid=s%3A...; Path=/; HttpOnly" }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthSuccessResponse' }
 *             example:
 *               message: "Successful sign up and user auto login"
 *               user: { id: "0192b3c4-...", name: "Akshay Kapoor", email: "akshay@dkwealth.com", role: "admin" }
 *       404:
 *         description: A user with the provided email already exists.
 *         content:
 *           application/json:
 *             example: { error: "User already exists. Please try a different account" }
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

router.post('/signup',SignupValidate,wrapAsync(signup))

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Log in with email and password
 *     description: |
 *       Validates email + password against stored bcrypt hash.
 *       On success, establishes a session and returns the safe user
 *       (password stripped).
 *     tags: [Authentication]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginRequest' }
 *           example:
 *             email: "akshay@dkwealth.com"
 *             password: "StrongPass@123"
 *     responses:
 *       200:
 *         description: Login successful.
 *         headers:
 *           Set-Cookie:
 *             description: Session cookie (`connect.sid`).
 *             schema: { type: string }
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthSuccessResponse' }
 *             example:
 *               message: "User logged in Successfully"
 *               user: { id: "0192b3c4-...", name: "Akshay Kapoor", email: "akshay@dkwealth.com", role: "admin" }
 *       404:
 *         description: User not found, or password mismatch.
 *         content:
 *           application/json:
 *             examples:
 *               userNotFound: { value: { error: "Cannot find user with email akshay@dkwealth.com" } }
 *               badPassword:  { value: { error: "Password does not match . Please provide correct password" } }
 *       500:
 *         description: Internal server error.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 */

router.post('/login',LoginValidate,wrapAsync(login))

/**
 * @openapi
 * /api/auth/getUsers:
 *   get:
 *     summary: List all admin users
 *     description: Returns every admin user. Each user object includes the array of their tasks.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: List of users fetched successfully.
 *         content:
 *           application/json:
 *             example:
 *               message: "Successfully retrieved users"
 *               users:
 *                 - id: "0192b3c4-..."
 *                   name: "Akshay Kapoor"
 *                   email: "akshay@dkwealth.com"
 *                   role: "admin"
 *                   tasks: []
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/getUsers',isAuthenticated,wrapAsync(getUsers))

/**
 * @openapi
 * /api/auth/getUser/{id}:
 *   get:
 *     summary: Fetch a single admin user by ID
 *     tags: [Authentication]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *         description: The user's UUID.
 *         example: "0192b3c4-d5e6-7f89-a0b1-c2d3e4f5a6b7"
 *     responses:
 *       200:
 *         description: User fetched.
 *         content:
 *           application/json:
 *             example:
 *               message: "Successfully retrieved user using id"
 *               user: { id: "0192b3c4-...", name: "Akshay Kapoor", email: "akshay@dkwealth.com", role: "admin", tasks: [] }
 *       404:
 *         description: User not found.
 *         content:
 *           application/json:
 *             example: { error: "User does not exist for given id" }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/InternalError' }
 */

router.get('/getUser/:id',isAuthenticated,wrapAsync(getSingleUser))

/**
 * @openapi
 * /api/auth/logout:
 *   get:
 *     summary: Log out the current session
 *     description: |
 *       Destroys the server-side session and clears the `connect.sid` cookie.
 *       Always returns 200, even if no session existed.
 *     tags: [Authentication]
 *     responses:
 *       200:
 *         description: Logged out.
 *         content:
 *           application/json:
 *             example: { message: "Logged out successfully" }
 *       500:
 *         description: Session destruction failed.
 *         content:
 *           application/json:
 *             example: { message: "Logout failed" }
 */

router.get('/logout',isAuthenticated,logout)

/**
 * @openapi
 * /api/auth/isAuthenticated:
 *   get:
 *     summary: Check whether the current session is valid
 *     description: |
 *       Used by the frontend on boot to decide whether to show the login
 *       screen or the dashboard. If a valid session exists, returns the
 *       cached user object.
 *     tags: [Authentication]
 *     security: []
 *     responses:
 *       200:
 *         description: Session is valid.
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/IsAuthenticatedResponse' }
 *       401:
 *         description: No active session.
 *         content:
 *           application/json:
 *             example: { message: "Not authenticated", user: null }
 *       500:
 *         description: Check failed.
 *         content:
 *           application/json:
 *             example: { message: "Authentication check failed", error: "..." }
 */

router.get('/isAuthenticated', isAuthenticatedController)

export default router