/**
 * Tasks controller.
 *
 * CRUD operations for "Task" records, each linked to a client and an
 * assigned admin user.
 */
const { prisma } = require('./init/prisma')

module.exports.create = async (req, res) => {
    try {

        const { title, description, clientId, category, priority, dueDate, status } = req.body

        // if user does not exist with given id return error
        const user = await prisma.user.findUnique({
            where: {
                id: clientId
            }
        })

        if (!user) {
            return res.status(404).json({
                error: 'Cannot generate Task . User does not exist for client id provided'
            })
        }

        // Create new task object
        const task = await prisma.task.create({
            data: {
                title: title,
                description: description,
                priority: priority,
                status: status,
                dueDate: dueDate,
                category: category,

                user: {
                    connect: {
                        id: clientId
                    }
                }
            }
        })

        return res.status(200).json({
            message: `Task generated for user ${user.name} successfully`,
            task: task
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }

}

module.exports.update = async (req, res) => {
    try {

        const { id, title, description, clientId, category, priority, dueDate, status } = req.body

        if (!id) {
            return res.status(404).json({
                error: 'Task ID not provided in payload'
            })
        }

        // if user does not exist with given id return error
        const user = await prisma.user.findUnique({
            where: {
                id: clientId
            }
        })

        if (!user) {
            return res.status(404).json({
                error: 'Cannot update Task . User does not exist for client id provided'
            })
        }

        // Create new task object
        const task = await prisma.task.update({
            where: {
                id: id
            },
            data: {
                title: title,
                description: description,
                priority: priority,
                status: status,
                dueDate: dueDate,
                category: category,

                user: {
                    connect: {
                        id: clientId
                    }
                }
            }
        })

        return res.status(200).json({
            message: `Task updated for user ${user.name} successfully`,
            task: task
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }

}

module.exports.getAll = async (req, res) => {
    try {

        // retrieve all tasks
        const tasks = await prisma.task.findMany()

        // otherwise return task 
        return res.status(200).json({
            message: 'Successfully fetched all tasks',
            tasks: tasks
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }

}

module.exports.getSingle = async (req, res) => {
    try {

        const { taskId } = req.params

        // If taskId does not exist return error
        if (!taskId) {
            return res.status(404).json({
                error: 'Task Id not provided'
            })
        }

        // Check if task exist for id provided or not
        const task = await prisma.task.findUnique({
            where: {
                id: taskId
            }
        })

        if (!task) {
            return res.status(404).json({
                error: 'Task does not exist for given id'
            })
        }

        // otherwise return task 
        return res.status(200).json({
            message: 'Successfully fetched task using taskId',
            task: task
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }

}

module.exports.remove = async (req, res) => {
    try {

        const { taskId } = req.params

        // If taskId does not exist return error
        if (!taskId) {
            return res.status(404).json({
                error: 'Task Id not provided'
            })
        }

        await prisma.task.delete({
            where: {
                id: taskId
            }
        })

        return res.status(200).json({
            message: 'Successfully deleted task'
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}