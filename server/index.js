// Application entry point.
//
// This file wires together the Express app: middleware (body parsing,
// CORS, cookies, sessions), the background cron jobs, and the three
// route groups (auth, tasks, leads). Run this file to start the server.

// Dependencies 
const express = require('express')
const app = express()

require('dotenv').config()

// Start date label update cron job
require('./jobs/dateStatusJob')
// Start daily CAMS ingestion cron job
require('./jobs/camsIngestionJob')
// Start monthly AMFI industry AUM ingestion cron job
require('./jobs/amfiIngestionJob')
// Start daily BSE Star Scheme Master ingestion cron job
require('./jobs/bseStarSchemeMasterIngestionJob')
// Start daily CAMS WBR22 → Company AUM ingestion cron job
require('./jobs/wbr22AumIngestionJob')
// Start daily Karvy WBR22 → Company AUM ingestion cron job
require('./jobs/karvyWbr22AumIngestionJob')
// Start daily Karvy transactions ingestion cron job
require('./jobs/karvyTransactionIngestionJob')

const session = require('express-session')
const cookieParser = require('cookie-parser')

const authRouter = require('./routes/authentication')
const taskRouter = require('./routes/tasks')
const leadRouter = require('./routes/leads')
const companyAumRouter = require('./routes/companyAum')
const analyticsRouter = require('./routes/analytics')

const cors = require('cors')

let port = process.env.PORT


// Setting url encoded true to read encoded query and params 
app.use(express.urlencoded({ 'extended': true }))
// Using express .json to directly read json data as javascript objects
app.use(express.json())

// Setting cors policy for incoming requests
app.use(cors({ origin: ['http://localhost:5173'], credentials: true }))


// Adding cookie parser with secret to read and set cookies
app.use(cookieParser(process.env.SECRET))

// Adding session related credentials
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}))

// Homepage route
app.get('/', (req, res) => {
    res.status(200).send({ 'message': 'Server is functional' })
})

// Auth routes router
app.use('/api/auth', authRouter)


// Task routes router
app.use('/api/tasks', taskRouter)

// Lead apis
app.use('/api/leads', leadRouter)

// Company AUM import apis
app.use('/api/company-aum', companyAumRouter)

// Business Analytics apis (mounted on both /api/analytics and /analytics)
app.use('/api/analytics', analyticsRouter)
app.use('/analytics', analyticsRouter)

// Central error handling middleware for wrapAsync / customError
app.use((err, req, res, next) => {
    const status = err.status || 500
    res.status(status).json({
        error: err.name || 'Error',
        message: err.message || 'Internal server error',
    })
})

app.listen(port, () => {
    console.log(`App listening at port http://localhost:${port}`)
})
