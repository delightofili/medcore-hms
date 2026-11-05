"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Plus } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatDate, formatMoney } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Invoice } from "@/types/billing";
import type { Paginated } from "@/types/common";

const FILTERS = [
  { value: "", label: "All" },
  { value: "open", label: "Unpaid" },
  { value: "DRAFT", label: "Drafts" },
  { value: "PAID", label: "Paid" },
  { value: "VOID", label: "Void" },
];

function BillingView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;

  const filter = searchParams.get("status") ?? "";
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<Invoice> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => setPage(1), [filter]);

  useEffect(() => {
    if (!hospitalId) return;
    let cancelled = false;

    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (filter) params.set("status", filter === "open" ? "OPEN" : filter);

    setData(null);
    setError("");
    authRequest<Paginated<Invoice>>(
      `/hospitals/${hospitalId}/invoices?${params}`,
    )
      .then((result) => !cancelled && setData(result))
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => {
      cancelled = true;
    };
  }, [hospitalId, filter, page, authRequest]);

  if (!hospitalId) {
    return (
      <EmptyState
        title="No hospital selected"
        message="Sign in with a hospital staff account."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Billing
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {data
              ? `${data.pagination.total} invoices`
              : "Invoices and payments"}
          </p>
        </div>
        <Link
          href="/dashboard/billing/new"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white hover:bg-red-700"
        >
          <Plus size={16} /> New invoice
        </Link>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() =>
              router.replace(
                item.value
                  ? `/dashboard/billing?status=${item.value}`
                  : "/dashboard/billing",
              )
            }
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              filter === item.value
                ? "bg-slate-900 text-white"
                : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState title="Could not load invoices" message={error} />
      ) : !data ? (
        <LoadingState message="Loading invoices..." />
      ) : data.items.length === 0 ? (
        <EmptyState
          title="No invoices"
          message="Nothing matches this filter yet."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Patient</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 text-right font-medium">Balance</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.items.map((invoice) => (
                <tr key={invoice.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <Link
                      href={`/dashboard/billing/${invoice.id}`}
                      className="font-mono text-xs font-semibold text-slate-900 hover:text-red-600"
                    >
                      {invoice.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {invoice.patient.firstName} {invoice.patient.lastName}
                  </td>
                  <td className="px-5 py-4 text-slate-500">
                    {formatDate(invoice.issuedAt ?? invoice.createdAt)}
                  </td>
                  <td className="px-5 py-4 text-right tabular-nums text-slate-900">
                    {formatMoney(
                      invoice.totalAmount,
                      invoice.hospital.currency,
                    )}
                  </td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums text-slate-900">
                    {invoice.status === "VOID"
                      ? "—"
                      : formatMoney(invoice.balance, invoice.hospital.currency)}
                  </td>
                  <td className="px-5 py-4">
                    <InvoiceStatusBadge invoice={invoice} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= data.pagination.pages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border border-slate-200 px-3 py-2 font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={<LoadingState message="Loading invoices..." />}>
      <BillingView />
    </Suspense>
  );
}
