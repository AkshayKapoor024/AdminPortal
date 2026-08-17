
const { prisma } = require('./init/prisma')
const bcrypt = require('bcrypt')

module.exports.signup = async (req, res) => {
    try {

        const { name, username, email, password, role } = req.body

        let existingUser = await prisma.user.findUnique({
            where: {
                email: email
            }
        })

        if (existingUser) {
            return res.status(404).json({
                error: 'User already exists. Please try a different account'
            })
        } else {

            // Hash user password
            const passwordHash = await bcrypt.hash(password, 12)

            const user = await prisma.user.create({
                data: {
                    name: name,
                    username: username,
                    email: email,
                    password: passwordHash,
                    role: role
                }
            })

            // Auto login after successful signup
            const { password: _, ...safeUser } = user
            req.session.user = safeUser
            req.session.session_id = user.id

            return res.status(200).json({
                message: 'Successful sign up and user auto login',
                user: safeUser
            })
        }
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            error_message: error.message
        })
    }
}

module.exports.login = async (req, res) => {
    try {

        const { email, password } = req.body

        // Find user exists
        const user = await prisma.user.findUnique({
            where: {
                email: email
            },
        })

        // if user does not exist then return error
        if (!user) {
            return res.status(404).json({
                error: `Cannot find user with email ${email}`
            })
        }

        // Compare password and if does not match return error
        const compare = await bcrypt.compare(password, user.password,)

        if (!compare) {
            return res.status(404).json({
                error: 'Password does not match . Please provide correct password'
            })
        }

        // Creating session
        const { password: _, ...safeUser } = user
        req.session.user = safeUser
        req.session.session_id = user.id

        return res.status(200).json({
            message: 'User logged in Successfully',
            user: safeUser
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}

module.exports.getUsers = async (req, res) => {
    try {

        const users = await prisma.user.findMany({
            include: {
                tasks: true
            }
        })

        return res.status(200).json({
            message: 'Successfully retrieved users',
            users: users
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}

module.exports.getSingleUser = async (req, res) => {
    try {

        const { id } = req.params

        if (!id) {
            return res.status(404).json({
                error: 'User ID not provided'
            })
        }

        const user = await prisma.user.findUnique({
            where: {
                id: id
            },
            include: {
                tasks: true
            }
        })

        if (!user) {
            return res.status(404).json({
                error: 'User does not exist for given id'
            })
        }

        return res.status(200).json({
            message: 'Successfully retrieved user using id',
            user: user
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}

module.exports.logout = (req, res) => {
    try {
        req.session.destroy((error) => {
            if (error) {
                return res.status(500).json({
                    message: "Logout failed",
                });
            }

            res.clearCookie("connect.sid");

            res.status(200).json({
                message: "Logged out successfully",
            });
        });

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}