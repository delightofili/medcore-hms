import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHash, randomUUID } from "crypto";
import { Request } from "express";
import { UserRole } from "@prisma/client";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { PrismaService } from "../database/prisma.service";
import { RedisService } from "../redis/redis.module";

interface RefreshPayload {
  sub: string;
  jti: string;
  typ: "refresh";
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  private get refreshSecret(): string {
    const secret = this.config.get<string>("JWT_REFRESH_SECRET");

    if (!secret) {
      throw new Error("JWT_REFRESH_SECRET is not configured");
    }

    return secret;
  }

  private get refreshTtl(): number {
    return Number(
      this.config.get<string>("JWT_REFRESH_EXPIRES_IN_SECONDS", "604800"),
    );
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private sessionKey(userId: string, jti: string): string {
    return `medcore:refresh:${userId}:${jti}`;
  }

  private async ensureRedisConnected(): Promise<void> {
    if (this.redis.client.status === "wait") {
      await this.redis.client.connect();
    }

    if (this.redis.client.status !== "ready") {
      throw new Error("Redis is not ready");
    }
  }

  private async createTokens(user: {
    id: string;
    role: UserRole;
    hospitalId: string | null;
  }) {
    await this.ensureRedisConnected();

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
    });

    const jti = randomUUID();

    const refreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti,
        typ: "refresh",
      },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl,
      },
    );

    const refreshTokenHash = this.hashToken(refreshToken);

    await this.redis.client.set(
      this.sessionKey(user.id, jti),
      refreshTokenHash,
      "EX",
      this.refreshTtl,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
    };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      throw new ConflictException("An account with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        firstName: dto.firstName.trim(),
        lastName: dto.lastName.trim(),
        email,
        passwordHash,
        role: UserRole.PATIENT,
        hospitalId: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        hospitalId: true,
        status: true,
      },
    });

    return {
      message: "Account created successfully",
      user,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const passwordIsValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordIsValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const tokens = await this.createTokens({
      id: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
    });

    await this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
      },
    });

    return {
      ...tokens,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
      },
    };
  }

  async refresh(refreshToken: string) {
    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token is required");
    }

    let payload: RefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<RefreshPayload>(
        refreshToken,
        {
          secret: this.refreshSecret,
        },
      );
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    if (!payload.sub || !payload.jti || payload.typ !== "refresh") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    await this.ensureRedisConnected();

    const key = this.sessionKey(payload.sub, payload.jti);
    const storedHash = await this.redis.client.get(key);
    const presentedHash = this.hashToken(refreshToken);

    if (!storedHash || storedHash !== presentedHash) {
      throw new UnauthorizedException("Refresh token has been revoked");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
        deletedAt: null,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      await this.redis.client.del(key);
      throw new UnauthorizedException("Account is not active");
    }

    /*
     * Redis Lua script performs validation and rotation atomically.
     * This prevents two concurrent refresh requests from successfully
     * rotating the same token.
     */
    const nextJti = randomUUID();

    const nextRefreshToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        jti: nextJti,
        typ: "refresh",
      },
      {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtl,
      },
    );

    const nextHash = this.hashToken(nextRefreshToken);

    const script = `
      local current = redis.call("GET", KEYS[1])
      if not current or current ~= ARGV[1] then
        return 0
      end
      redis.call("DEL", KEYS[1])
      redis.call("SET", KEYS[2], ARGV[2], "EX", ARGV[3])
      return 1
    `;

    const rotated = await this.redis.client.eval(
      script,
      2,
      key,
      this.sessionKey(user.id, nextJti),
      presentedHash,
      nextHash,
      String(this.refreshTtl),
    );

    if (rotated !== 1) {
      throw new UnauthorizedException("Refresh token has already been used");
    }

    const accessToken = await this.jwtService.signAsync({
      sub: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
    });

    return {
      accessToken,
      refreshToken: nextRefreshToken,
      tokenType: "Bearer",
      expiresIn: 900,
    };
  }

  async logout(userId: string, refreshToken?: string) {
    await this.ensureRedisConnected();

    if (refreshToken) {
      try {
        const payload = await this.jwtService.verifyAsync<RefreshPayload>(
          refreshToken,
          {
            secret: this.refreshSecret,
          },
        );

        if (payload.sub === userId && payload.jti) {
          await this.redis.client.del(this.sessionKey(userId, payload.jti));
        }
      } catch {
        // Invalid or expired tokens are already unusable.
      }
    }

    return {
      message: "Logged out successfully",
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        hospitalId: true,
        createdAt: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    return user;
  }
}
