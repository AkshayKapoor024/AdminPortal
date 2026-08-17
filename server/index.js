// Dependencies 
const express = require('express')
const app = express()

require('dotenv').config()

const session = require('express-session')
const cookieParser = require('cookie-parser')

const authRouter = require('./routes/authentication')
const taskRouter = require('./routes/tasks')
const leadRouter = require('./routes/leads')

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
app.use('/api/task', taskRouter)

// Lead apis
app.use('/api/lead', leadRouter)

app.listen(port, () => {
    console.log(`App listening at port http://localhost:${port}`)
})