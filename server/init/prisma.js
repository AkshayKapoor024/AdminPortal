// Sets up the single, shared Prisma client used everywhere else in the
// app to talk to PostgreSQL. Other files import `{ prisma }` from here
// instead of creating their own client, so there's only one connection
// pool for the whole server.
import { PrismaClient } from '../src/generated/prisma/client.js'
import { PrismaPg } from '@prisma/adapter-pg'

// The adapter is what lets Prisma connect to PostgreSQL using the
// connection string from the environment (DATABASE_URL).
const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL
})

export const prisma = new PrismaClient({
    adapter
})
