import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

/** CORS_ORIGIN can hold several origins separated by commas. */
function allowedOrigins() {
  return (process.env.CORS_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger("Bootstrap");

  app.enableCors({
    origin: allowedOrigins(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  app.setGlobalPrefix("api");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  // Locally we stay on 127.0.0.1. Hosts like Render need 0.0.0.0 so outside traffic can reach the app.
  const host =
    process.env.HOST ??
    (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1");

  await app.listen(port, host);

  logger.log(`MedCore API on http://${host}:${port}/api`);
  logger.log(`CORS allowed: ${allowedOrigins().join(", ")}`);
  logger.log(
    `Server time zone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`,
  );
}

bootstrap();
