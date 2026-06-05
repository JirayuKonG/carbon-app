import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

function parseAllowedOrigins(value?: string) {
  if (!value?.trim()) {
    return ['http://localhost:5173', 'http://localhost:4173']
  }

  return value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
}

async function bootstrap() {
//   const app = await NestFactory.create(AppModule) // idea
  const app = await NestFactory.create(AppModule, { bodyParser: false }) // kong
  
  const port = Number.parseInt(process.env.PORT ?? '3000', 10)
  const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS)
  
  const importBodyLimit = '50mb'
  // Large CSV imports submit the mapped rows as one JSON payload.
  app.use(json({ limit: importBodyLimit }))
  app.use(urlencoded({ extended: true, limit: importBodyLimit }))

  
  // Global prefix
  app.setGlobalPrefix('api')

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  // CORS
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  })

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Carbon Footprint API')
    .setDescription('Carbon Footprint Management & Traceability — Schema v1.3')
    .setVersion('1.3.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('api/docs', app, document)

  await app.listen(port)
  console.log(`🌿 Carbon Footprint API running on http://localhost:${port}/api`)
  console.log(`📚 Swagger docs at     http://localhost:${port}/api/docs`)
}
bootstrap()
