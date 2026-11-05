import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  href?: string;
  tone?: "default" | "warning";
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
  tone = "default",
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div
          className={`rounded-xl p-2 ${tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"}`}
        >
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-slate-900">
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </>
  );

  const className = "block rounded-2xl border border-slate-200 bg-white p-5";

  return href ? (
    <Link
      href={href}
      className={`${className} transition hover:border-slate-300 hover:shadow-sm`}
    >
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
