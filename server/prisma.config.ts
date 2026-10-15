import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
  experimental: {
    externalTables: true,
  },
  tables: {
    external: [
      'public.BseOrders',
      'public.BseSchemes',
      'public.BseStatusHistories',
      'public.BseUccs',
      'public.Clients',
      'public.NavHistories',
      'public.RefreshTokens',
      'public.Schemes',
      'public.Transactions',
      'public.Users',
      'public.bse_webhook_events',
    ],
  },
})