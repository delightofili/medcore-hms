import {
  CalendarDays,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  Pill,
  Settings,
  Users,
} from "lucide-react";

import type { UserRole } from "@/types/auth";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
};

// Roles here mirror what each API module allows, so nobody sees a link
// that would only lead to a 403.
export const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: [
      "SUPER_ADMIN",
      "HOSPITAL_ADMIN",
      "DOCTOR",
      "NURSE",
      "RECEPTIONIST",
      "LAB_TECHNICIAN",
      "PHARMACIST",
      "ACCOUNTANT",
      "PATIENT",
    ],
  },
  {
    label: "Patients",
    href: "/dashboard/patients",
    icon: Users,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  },
  {
    label: "Appointments",
    href: "/dashboard/appointments",
    icon: CalendarDays,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE", "RECEPTIONIST"],
  },
  {
    label: "Medical Records",
    href: "/dashboard/records",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
  },
  {
    label: "Pharmacy",
    href: "/dashboard/pharmacy",
    icon: Pill,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "PHARMACIST"],
  },
  {
    label: "Billing",
    href: "/dashboard/billing",
    icon: CreditCard,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT"],
  },
  {
    label: "Administration",
    href: "/dashboard/administration",
    icon: Settings,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  },
];

export function navigationFor(role?: UserRole) {
  return role ? navigation.filter((item) => item.roles.includes(role)) : [];
}

export function isActive(pathname: string, href: string) {
  return (
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
  );
}
