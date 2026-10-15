import { prisma } from '../init/prisma.js';

export const create = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const owner = await prisma.user.findUnique({ where: { id: ownerId } })
        if (!owner) return res.status(404).json({ error: 'Logged-in user not found' })

        const {
            name, email, mobile, pan, interested, lead_value,
            status, source, nature, follow_up_date, reminder,
            description, clientId,
        } = req.body

        const fileNames = []
        req.files?.forEach((file) => fileNames.push(file.filename))

        const lead = await prisma.lead.create({
            data: {
                name,
                email,
                mobile,
                interested,
                lead_value,
                status,
                source,
                nature,
                pan,
                follow_up_date: new Date(follow_up_date),
                reminder,
                description,
                documents: fileNames,
                clientId: clientId || null,
                userId: owner.id,       // 👈 owner = logged-in user
            },
        })

        return res.status(200).json({
            message: `Lead generated for user ${owner.name} successfully`,
            lead,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

export const update = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const {
            id, name, email, mobile, pan, interested, lead_value,
            status, source, nature, follow_up_date, reminder,
            description, clientId,
        } = req.body

        if (!id) return res.status(400).json({ error: 'Lead ID not provided' })

        const existing = await prisma.lead.findUnique({ where: { id } })
        if (!existing) return res.status(404).json({ error: 'Lead not found' })
        if (existing.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to edit this lead' })
        }

        const fileNames = []
        req.files?.forEach((file) => fileNames.push(file.filename))

        const lead = await prisma.lead.update({
            where: { id },
            data: {
                name,
                email,
                mobile,
                interested,
                lead_value,
                status,
                source,
                pan,
                nature,
                follow_up_date: new Date(follow_up_date),
                reminder,
                description,
                documents: { push: fileNames },
                clientId: clientId || null,
                userId: ownerId,
            },
        })

        return res.status(200).json({
            message: `Lead updated for user ${ownerId} successfully`,
            lead,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

export const getAll = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const leads = await prisma.lead.findMany({
            where: { userId: ownerId },
            orderBy: { follow_up_date: 'asc' },
        })

        return res.status(200).json({
            message: 'Successfully fetched your leads',
            leads,
        })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

export const getSingle = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const { leadId } = req.params
        if (!leadId) return res.status(400).json({ error: 'Lead Id not provided' })

        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) return res.status(404).json({ error: 'Lead not found' })
        if (lead.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to view this lead' })
        }

        return res.status(200).json({ message: 'Successfully fetched lead', lead })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}

export const remove = async (req, res) => {
    try {
        const ownerId = req.session?.session_id
        if (!ownerId) return res.status(401).json({ error: 'Not authenticated' })

        const { leadId } = req.params
        if (!leadId) return res.status(400).json({ error: 'Lead Id not provided' })

        const existing = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!existing) return res.status(404).json({ error: 'Lead not found' })
        if (existing.userId !== ownerId) {
            return res.status(403).json({ error: 'Not allowed to delete this lead' })
        }

        await prisma.lead.delete({ where: { id: leadId } })

        return res.status(200).json({ message: 'Successfully deleted lead' })
    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        })
    }
}