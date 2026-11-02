"use client";

import { CalendarDays, Users, ClipboardList, Activity } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";

const cards = [
  {
    label: "Patients",
    value: "—",
    description: "Patient records",
    icon: Users,
  },
  {
    label: "Appointments",
    value: "—",
    description: "Scheduled visits",
    icon: CalendarDays,
  },
  {
    label: "Medical Records",
    value: "—",
    description: "Clinical records",
    icon: ClipboardList,
  },
  {
    label: "System Status",
    value: "Connected",
    description: "Your session is active",
    icon: Activity,
  },
];

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-red-600">
          {user?.role.replaceAll("_", " ")}
        </p>

        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
          Dashboard
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Here&apos;s your MedCore workspace overview.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <div
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-slate-500">
                  {card.label}
                </p>

                <div className="rounded-xl bg-red-50 p-2 text-red-600">
                  <Icon size={18} />
                </div>
              </div>

              <p className="mt-5 text-2xl font-bold text-slate-900">
                {card.value}
              </p>

              <p className="mt-1 text-xs text-slate-500">{card.description}</p>
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <Activity className="mx-auto text-slate-400" size={32} />

        <h3 className="mt-4 font-semibold text-slate-900">
          Your workspace is ready
        </h3>

        <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
          Dashboard metrics will appear here as patient, appointment,
          laboratory, and billing features are connected.
        </p>
      </div>
    </div>
  );
}
