"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Pill,
  RefreshCw,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";

import { StatusBadge } from "@/components/appointments/status-badge";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatMoney, formatTime, humanize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { DashboardSummary } from "@/types/dashboard";

const REFRESH_MS = 60_000;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function DashboardPage() {
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!hospitalId) return;
    setIsRefreshing(true);
    try {
      setSummary(
        await authRequest<DashboardSummary>(
          `/hospitals/${hospitalId}/dashboard`,
        ),
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard");
    } finally {
      setIsRefreshing(false);
    }
  }, [hospitalId, authRequest]);

  // Load now, then refresh every minute while the tab is visible.
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  if (!user) return null;

  if (!hospitalId) {
    return (
      <EmptyState
        title="Platform administrator"
        message="Your account is not tied to a single hospital. Sign in with a hospital account to see its dashboard."
      />
    );
  }

  if (error && !summary)
    return <ErrorState title="Could not load dashboard" message={error} />;
  if (!summary) return <LoadingState message="Loading your dashboard..." />;

  const { appointments, patients, clinical, pharmacy, billing, hospital } =
    summary;
  const money = (value: string) => formatMoney(value, hospital.currency);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-red-600">
            {humanize(user.role)} · {hospital.name}
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {greeting()}, {user.firstName}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>

        <button
          type="button"
          onClick={load}
          disabled={isRefreshing}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          Updated {formatTime(summary.generatedAt)}
        </button>
      </div>

      {error && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Showing the last loaded numbers. {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {appointments && (
          <>
            <StatCard
              label={
                user.role === "DOCTOR"
                  ? "My patients today"
                  : "Appointments today"
              }
              value={appointments.today}
              hint={`${appointments.completed} completed · ${appointments.cancelled} cancelled or no show`}
              icon={CalendarDays}
              href="/dashboard/appointments"
            />
            <StatCard
              label="Waiting to be seen"
              value={appointments.waiting}
              hint={`${appointments.inProgress} in consultation now`}
              icon={Users}
              href="/dashboard/appointments"
              tone={appointments.waiting > 0 ? "warning" : "default"}
            />
          </>
        )}

        {patients && (
          <StatCard
            label="Registered patients"
            value={patients.total.toLocaleString()}
            hint={`${patients.newThisMonth} new this month`}
            icon={UserPlus}
            href="/dashboard/patients"
          />
        )}

        {clinical && (
          <StatCard
            label={
              user.role === "DOCTOR"
                ? "My unsigned records"
                : "Unsigned records"
            }
            value={clinical.draftRecords}
            hint={`${clinical.signedRecords} signed in total`}
            icon={ClipboardList}
            href="/dashboard/records?status=DRAFT"
            tone={clinical.draftRecords > 0 ? "warning" : "default"}
          />
        )}

        {pharmacy && (
          <StatCard
            label="Awaiting dispense"
            value={pharmacy.awaitingDispense}
            hint={`${pharmacy.dispensedToday} dispensed today`}
            icon={Pill}
            href="/dashboard/pharmacy"
            tone={pharmacy.awaitingDispense > 0 ? "warning" : "default"}
          />
        )}

        {billing && (
          <>
            <StatCard
              label="Collected today"
              value={money(billing.revenueToday)}
              hint={`${money(billing.revenueThisMonth)} this month`}
              icon={Wallet}
              href="/dashboard/billing"
            />
            <StatCard
              label="Outstanding"
              value={money(billing.outstanding)}
              hint={`${billing.unpaidInvoices} unpaid invoices`}
              icon={CreditCard}
              href="/dashboard/billing?status=open"
            />
            {billing.overdueInvoices > 0 && (
              <StatCard
                label="Overdue invoices"
                value={billing.overdueInvoices}
                hint="Past their due date"
                icon={AlertCircle}
                href="/dashboard/billing?status=open"
                tone="warning"
              />
            )}
          </>
        )}
      </div>

      {appointments && (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <h3 className="font-semibold text-slate-900">
              {user.role === "DOCTOR"
                ? "Your next patients"
                : "Next in the queue"}
            </h3>
            <Link
              href="/dashboard/appointments"
              className="text-sm font-medium text-red-600 hover:text-red-700"
            >
              View day
            </Link>
          </div>

          {appointments.upcoming.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              Nobody waiting. The queue is clear.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {appointments.upcoming.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
                >
                  <div className="flex items-center gap-4">
                    <p className="w-12 text-sm font-semibold tabular-nums text-slate-900">
                      {formatTime(item.appointmentAt)}
                    </p>
                    <div>
                      <Link
                        href={
                          ["CHECKED_IN", "IN_PROGRESS"].includes(item.status) &&
                          user.role !== "RECEPTIONIST"
                            ? `/dashboard/appointments/${item.id}/consult`
                            : `/dashboard/patients/${item.patient.id}`
                        }
                        className="text-sm font-medium text-slate-900 hover:text-red-600"
                      >
                        {item.patient.firstName} {item.patient.lastName}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Dr {item.doctor.user.lastName}
                        {item.reason && ` · ${item.reason}`}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
