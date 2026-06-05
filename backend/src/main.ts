import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false })
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
    origin: ['http://localhost:5173', 'http://localhost:4173'],
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

  await app.listen(3000)
  console.log('🌿 Carbon Footprint API running on http://localhost:3000/api')
  console.log('📚 Swagger docs at     http://localhost:3000/api/docs')
}
bootstrap()
