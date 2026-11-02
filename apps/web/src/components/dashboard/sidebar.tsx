"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  CreditCard,
  FlaskConical,
  LayoutDashboard,
  Pill,
  Settings,
  Users,
} from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import type { UserRole } from "@/types/auth";

type NavigationItem = {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles: UserRole[];
};

const allRoles: UserRole[] = [
  "SUPER_ADMIN",
  "HOSPITAL_ADMIN",
  "DOCTOR",
  "NURSE",
  "RECEPTIONIST",
  "LAB_TECHNICIAN",
  "PHARMACIST",
  "ACCOUNTANT",
  "PATIENT",
];

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    roles: allRoles,
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
    roles: allRoles,
  },
  {
    label: "Medical Records",
    href: "/dashboard/records",
    icon: ClipboardList,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "NURSE"],
  },
  {
    label: "Laboratory",
    href: "/dashboard/laboratory",
    icon: FlaskConical,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "DOCTOR", "LAB_TECHNICIAN"],
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
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN", "ACCOUNTANT", "PATIENT"],
  },
  {
    label: "Administration",
    href: "/dashboard/administration",
    icon: Settings,
    roles: ["SUPER_ADMIN", "HOSPITAL_ADMIN"],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();

  const items = navigation.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  );

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white md:flex md:flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-white">
            <Activity size={20} />
          </div>

          <div>
            <p className="font-bold text-slate-900">MedCore</p>
            <p className="text-xs text-slate-500">Hospital Management</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-4">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition ${
                active
                  ? "bg-red-50 text-red-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon size={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-4">
        <p className="text-xs text-slate-400">MedCore HMS</p>
        <p className="mt-1 text-xs text-slate-500">Version 0.1.0</p>
      </div>
    </aside>
  );
}
