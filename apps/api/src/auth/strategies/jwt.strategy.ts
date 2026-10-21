import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { PrismaService } from "../../database/prisma.service";

interface AccessTokenPayload {
  sub: string;
  role: string;
  hospitalId: string | null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = config.get<string>("JWT_ACCESS_SECRET");

    if (!secret) {
      throw new Error("JWT_ACCESS_SECRET is not configured");
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: AccessTokenPayload) {
    if (!payload.sub) {
      throw new UnauthorizedException("Invalid access token");
    }

    const user = await this.prisma.user.findFirst({
      where: {
        id: payload.sub,
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
      },
    });

    if (!user) {
      throw new UnauthorizedException("Account not found");
    }

    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      hospitalId: user.hospitalId,
    };
  }
}
