import { humanize } from "@/lib/format";
import type { AppointmentStatus } from "@/types/appointment";

const styles: Record<AppointmentStatus, string> = {
  SCHEDULED: "bg-slate-100 text-slate-700",
  CONFIRMED: "bg-blue-50 text-blue-700",
  CHECKED_IN: "bg-amber-50 text-amber-800",
  IN_PROGRESS: "bg-emerald-50 text-emerald-700",
  COMPLETED: "bg-emerald-600 text-white",
  CANCELLED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-slate-200 text-slate-600",
};

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {humanize(status)}
    </span>
  );
}
