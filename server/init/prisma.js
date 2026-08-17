const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

module.exports.prisma = new PrismaClient({
    adapter
})