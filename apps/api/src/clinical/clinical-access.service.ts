import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "../database/prisma.service";
import {
  TenantAccessService,
  TenantPrincipal,
} from "../auth/tenant-access.service";

@Injectable()
export class ClinicalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  async requireRole(
    actorId: string,
    hospitalId: string,
    allowed: Set<UserRole>,
    message: string,
  ): Promise<TenantPrincipal> {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (!allowed.has(actor.role)) throw new ForbiddenException(message);

    return actor;
  }

  /** Only a doctor with a profile in this hospital can write clinical notes. */
  async requireDoctor(actorId: string, hospitalId: string) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (actor.role !== UserRole.DOCTOR) {
      throw new ForbiddenException("Only doctors can write clinical records");
    }

    const doctor = await this.prisma.doctor.findFirst({
      where: { userId: actor.id, hospitalId, deletedAt: null },
      select: { id: true },
    });

    if (!doctor) {
      throw new ForbiddenException(
        "Your doctor profile is not set up for this hospital",
      );
    }

    return { actor, doctorId: doctor.id };
  }
}
