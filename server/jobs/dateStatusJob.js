const cron = require('node-cron')
const { prisma } = require('../init/prisma')
const getDateLabel = require('../utils/date_processor')

// Schedule cron job everyday at 8:00 AM

cron.schedule('0 8 * * *', async () => {
    try {

        // get all tasks
        const tasks = await prisma.task.findMany({
            where: {
                dueDateLabel: {
                    not: "Expired"
                }
            }
        })

        // update task
        for (const task of tasks) {
            const label = getDateLabel(task.dueDate)

            await prisma.task.update({
                where: {
                    id: task.id
                },
                data: {
                    dueDateLabel: label
                }
            })
        }

        // Get all leads
        const leads = await prisma.lead.findMany({
            where: {
                follow_up_label: {
                    not: "Expired"
                }
            }
        })

        // update lead
        for (lead of leads) {
            const label = getDateLabel(lead.follow_up_date)

            await prisma.lead.update({
                where: {
                    id: lead.id
                },
                data: {
                    follow_up_label: label
                }
            })
        }

        console.log('Daily date status update completed')
    } catch (error) {
        console.error('Date status cron failed', error.message)
    }

}, {
    timezone:'Asia/Kolkata'
})
