import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { Prisma, PrismaClient } from '@prisma/client'

const DEFAULT_CONNECTION_LIMIT = 5
const DEFAULT_POOL_TIMEOUT_SECONDS = 20

function positiveIntegerEnv(name: string, fallback: number) {
  const raw = process.env[name]?.trim()
  if (!raw) return fallback
  const parsed = Number(raw)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

function databaseUrlWithSafePoolDefaults(databaseUrl: string | undefined) {
  if (!databaseUrl) return undefined

  try {
    const url = new URL(databaseUrl)
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(positiveIntegerEnv('PRISMA_CONNECTION_LIMIT', DEFAULT_CONNECTION_LIMIT)))
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(positiveIntegerEnv('PRISMA_POOL_TIMEOUT', DEFAULT_POOL_TIMEOUT_SECONDS)))
    }
    return url.toString()
  } catch {
    return databaseUrl
  }
}

function prismaClientOptions(): Prisma.PrismaClientOptions | undefined {
  const databaseUrl = databaseUrlWithSafePoolDefaults(process.env.DATABASE_URL)
  return databaseUrl ? { datasources: { db: { url: databaseUrl } } } : undefined
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super(prismaClientOptions())
  }

  async onModuleInit() {
    await this.$connect()
  }
  async onModuleDestroy() {
    await this.$disconnect()
  }
}
