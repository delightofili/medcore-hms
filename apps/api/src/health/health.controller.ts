import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.module";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: is the process up? Touches nothing else, so uptime pings stay cheap. */
  @Get()
  getHealth() {
    return {
      status: "ok",
      service: "medcore-api",
      timestamp: new Date().toISOString(),
    };
  }

  /** Readiness: can the API actually reach its database and Redis? */
  @Get("ready")
  async getReadiness() {
    const check = async (name: string, probe: () => Promise<unknown>) => {
      const started = Date.now();
      try {
        await probe();
        return { name, ok: true, ms: Date.now() - started };
      } catch (error) {
        return {
          name,
          ok: false,
          error: error instanceof Error ? error.message : "unknown",
        };
      }
    };

    const results = await Promise.all([
      check("database", () => this.prisma.$queryRaw`SELECT 1`),
      check("redis", () => this.redis.client.ping()),
    ]);

    const body = {
      status: results.every((result) => result.ok) ? "ready" : "degraded",
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      checks: results,
    };

    if (body.status !== "ready") throw new ServiceUnavailableException(body);
    return body;
  }
}
