/**
 * Leads controller.
 *
 * CRUD operations for "Lead" records (prospective clients), including
 * attaching uploaded supporting documents via multer and linking each
 * lead to the admin user (`primary_user`) who owns it.
 */
const { prisma } = require('./init/prisma')

module.exports.create = async (req, res) => {
    try {

        const { name, email, mobile, pan, interested, lead_value, status, source, nature, follow_up_date, reminder, description, primary_user } = req.body

        // if user does not exist with given id return error
        const user = await prisma.user.findUnique({
            where: {
                email: primary_user
            }
        })

        if (!user) {
            return res.status(404).json({
                error: 'Cannot generate Lead . User does not exist for client id provided'
            })
        }

        // Store filenames 
        const fileNames = []
        req.files?.forEach((file) => {
            fileNames.push(file.filename)
        })

        // Create new lead object
        const lead = await prisma.lead.create({
            data: {
                name: name,
                email: email,
                mobile: mobile,
                interested: interested,
                lead_value: lead_value,
                status: status,
                source: source,
                nature: nature,
                pan: pan,
                follow_up_date: follow_up_date,
                reminder: reminder,
                description: description,
                documents: fileNames,
                user: {
                    connect: {
                        email: primary_user
                    }
                }
            }
        })

        return res.status(200).json({
            message: `Lead generated for user ${user.name} successfully`,
            lead: lead
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

        const { id, name, email, mobile, pan, interested, lead_value, status, source, nature, follow_up_date, reminder, description, primary_user } = req.body

        if (!id) {
            return res.status(404).json({
                error: 'Lead ID not provided in payload'
            })
        }

        // if user does not exist with given id return error
        const user = await prisma.user.findUnique({
            where: {
                email: primary_user
            }
        })

        if (!user) {
            return res.status(404).json({
                error: 'Cannot update Lead . User does not exist for client id provided'
            })
        }


        // Store filenames 
        const fileNames = []
        req.files?.forEach((file) => {
            fileNames.push(file.filename)
        })

        // Create new lead object
        const lead = await prisma.lead.update({
            where: {
                id: id
            },
            data: {
                name: name,
                email: email,
                mobile: mobile,
                interested: interested,
                lead_value: lead_value,
                status: status,
                source: source,
                pan: pan,
                nature: nature,
                follow_up_date: follow_up_date,
                reminder: reminder,
                description: description,
                documents: {
                    push: fileNames
                },
                user: {
                    connect: {
                        email: primary_user
                    }
                }
            }
        })

        return res.status(200).json({
            message: `Lead updated for user ${user.name} successfully`,
            lead: lead
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

        // retrieve all leads
        const leads = await prisma.lead.findMany()

        // otherwise return task 
        return res.status(200).json({
            message: 'Successfully fetched all leads',
            leads: leads
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

        const { leadId } = req.params

        // If taskId does not exist return error
        if (!leadId) {
            return res.status(404).json({
                error: 'Lead Id not provided'
            })
        }

        // Check if lead exist for id provided or not
        const lead = await prisma.lead.findUnique({
            where: {
                id: leadId
            }
        })

        if (!lead) {
            return res.status(404).json({
                error: 'Lead does not exist for given id'
            })
        }

        // otherwise return lead
        return res.status(200).json({
            message: 'Successfully fetched Lead using LeadId',
            lead: lead
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

        const { leadId } = req.params

        // If leadId does not exist return error
        if (!leadId) {
            return res.status(404).json({
                error: 'Lead Id not provided'
            })
        }

        await prisma.lead.delete({
            where: {
                id: leadId
            }
        })

        return res.status(200).json({
            message: 'Successfully deleted lead'
        })

    } catch (error) {
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        })
    }
}