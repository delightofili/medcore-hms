import { Injectable, Logger, Module, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis, { RedisOptions } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: Redis;

  constructor(config: ConfigService) {
    const options: RedisOptions = {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
    };

    // Hosted Redis (Render Key Value) hands you one URL. Local Docker uses host, port and password.
    const url = config.get<string>("REDIS_URL");

    this.client = url
      ? new Redis(url, options)
      : new Redis({
          ...options,
          host: config.get<string>("REDIS_HOST", "127.0.0.1"),
          port: Number(config.get<string>("REDIS_PORT", "6379")),
          password: config.get<string>("REDIS_PASSWORD") || undefined,
        });

    this.client.on("error", (error) => {
      this.logger.error(`Redis connection error: ${error.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client.status === "end") {
      return;
    }

    await this.client.quit().catch(() => undefined);
  }
}

@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
