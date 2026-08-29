// Sets up the single, shared Prisma client used everywhere else in the
// app to talk to PostgreSQL. Other files import `{ prisma }` from here
// instead of creating their own client, so there's only one connection
// pool for the whole server.
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')

// The adapter is what lets Prisma connect to PostgreSQL using the
// connection string from the environment (DATABASE_URL).
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

module.exports.prisma = new PrismaClient({
    adapter
})
