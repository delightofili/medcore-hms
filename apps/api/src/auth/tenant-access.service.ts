import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";

export interface TenantPrincipal {
  id: string;
  role: UserRole;
  hospitalId: string | null;
}

@Injectable()
export class TenantAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getActivePrincipal(userId: string): Promise<TenantPrincipal> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
      },
      select: {
        id: true,
        role: true,
        hospitalId: true,
        status: true,
      },
    });

    if (!user || user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    return {
      id: user.id,
      role: user.role,
      hospitalId: user.hospitalId,
    };
  }

  async requireHospitalAdmin(
    userId: string,
    requestedHospitalId: string,
  ): Promise<TenantPrincipal> {
    const principal = await this.getActivePrincipal(userId);

    if (principal.role === UserRole.SUPER_ADMIN) {
      return principal;
    }

    if (
      principal.role !== UserRole.HOSPITAL_ADMIN ||
      principal.hospitalId !== requestedHospitalId
    ) {
      throw new ForbiddenException("You do not have access to this hospital");
    }

    return principal;
  }

  async requireHospitalMembership(
    userId: string,
    hospitalId: string,
  ): Promise<TenantPrincipal> {
    const principal = await this.getActivePrincipal(userId);

    if (principal.role === UserRole.SUPER_ADMIN) {
      return principal;
    }

    if (!principal.hospitalId || principal.hospitalId !== hospitalId) {
      throw new ForbiddenException("You do not have access to this hospital");
    }

    return principal;
  }
}
