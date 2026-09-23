const { prisma } = require('../init/prisma')

module.exports.create = async (req, res) => {
    try {
        // 1. Get owner id from session — never trust the frontend for this
        const ownerId = req.session?.session_id
        if (!ownerId) {
            return res.status(401).json({ error: 'Not authenticated' })
        }

        // 2. Confirm the owner user actually exists
        const owner = await prisma.user.findUnique({ where: { id: ownerId } })
        if (!owner) {
            return res.status(404).json({
                error: 'Cannot generate Task. Logged-in user not found.',
            })
        }

        // 3. Payload (clientId is a plain string for now — later a real Client.id)
        const {
            title, description, clientId,
            category, priority, dueDate, status,
        } = req.body

        const task = await prisma.task.create({
            data: {
                title,
                description,
                priority,
                status,
                dueDate: new Date(dueDate),
                category,
                clientId,                 // 👈 plain string, no relation yet
                userId: owner.id,         // 👈 owner = logged-in user
            },
        })

        return res.status(200).json({
            message: `Task generated for user ${owner.name} successfully`,
            task,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

module.exports.update = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const {
            id, title, description, clientId,
            category, priority, dueDate, status,
        } = req.body

        if (!id) return res.status(400).json({ error: 'Task ID not provided' })

        // Make sure the task belongs to this user
        const existing = await prisma.task.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ error: 'Task not found' })
        if (existing.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to edit this task' })
        }

        const task = await prisma.task.update({
            where: { id },
            data: {
                title,
                description,
                priority,
                status,
                dueDate: new Date(dueDate),
                category,
                clientId,                 // 👈 plain string
                userId: ownerId,          // keep owner fixed
            },
        })

        return res.status(200).json({
            message: `Task updated successfully`,
            task,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

// Only return tasks owned by the logged-in user
module.exports.getAll = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const tasks = await prisma.task.findMany({
            where: { userId: ownerId },
            orderBy: { dueDate: 'asc' },
        })

        return res.status(200).json({
            message: 'Successfully fetched your tasks',
            tasks,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

module.exports.getSingle = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const { taskId } = req.params
        if (!taskId) return res.status(400).json({ error: 'Task Id not provided' })

        const task = await prisma.task.findUnique({ where: { id: taskId } })
        if (!task) return res.status(404).json({ error: 'Task not found' })
        if (task.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to view this task' })
        }

        return res.status(200).json({
            message: 'Successfully fetched task',
            task,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

module.exports.remove = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const { taskId } = req.params
        if (!taskId) return res.status(400).json({ error: 'Task Id not provided' })

        const existing = await prisma.task.findUnique({ where: { id: taskId } })
        if (!existing) return res.status(404).json({ error: 'Task not found' })
        if (existing.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to delete this task' })
        }

        await prisma.task.delete({ where: { id: taskId } })

        return res.status(200).json({ message: 'Successfully deleted task' })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}