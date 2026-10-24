import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@prisma/client";

const STAFF_ROLES = [
  UserRole.DOCTOR,
  UserRole.NURSE,
  UserRole.RECEPTIONIST,
  UserRole.LAB_TECHNICIAN,
  UserRole.PHARMACIST,
  UserRole.ACCOUNTANT,
] as const;

export function assertCanCreateStaffRole(
  actorRole: UserRole,
  targetRole: UserRole,
): void {
  if (actorRole === UserRole.SUPER_ADMIN) {
    if (targetRole === UserRole.SUPER_ADMIN) {
      throw new ForbiddenException(
        "Super Admin accounts must be provisioned through a separate controlled process",
      );
    }

    return;
  }

  if (actorRole !== UserRole.HOSPITAL_ADMIN) {
    throw new ForbiddenException("You cannot create staff accounts");
  }

  if (!(STAFF_ROLES as readonly UserRole[]).includes(targetRole)) {
    throw new ForbiddenException(
      "Hospital Admins cannot create this account role",
    );
  }
}
