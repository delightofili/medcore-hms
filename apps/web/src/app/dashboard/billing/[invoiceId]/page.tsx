"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { InvoiceStatusBadge } from "@/components/billing/invoice-status-badge";
import { PaymentDialog } from "@/components/billing/payment-dialog";
import { ErrorState, LoadingState } from "@/components/ui/feedback";
import { formatDate, formatMoney, formatTime, humanize } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Invoice } from "@/types/billing";

const PAYABLE = ["ISSUED", "PARTIALLY_PAID", "OVERDUE"];

export default function InvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { user, authRequest } = useAuth();
  const hospitalId = user?.hospitalId;
  const url = `/hospitals/${hospitalId}/invoices/${invoiceId}`;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    if (!hospitalId) return;
    authRequest<Invoice>(url)
      .then(setInvoice)
      .catch((err: Error) => setError(err.message));
  }, [hospitalId, url, authRequest]);

  async function act(path: string, body?: object) {
    setBusy(true);
    setActionError("");
    try {
      setInvoice(
        await authRequest<Invoice>(`${url}/${path}`, { method: "POST", body }),
      );
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleIssue() {
    if (
      window.confirm(
        "Issue this invoice? Issued invoices can no longer be edited.",
      )
    )
      act("issue");
  }

  function handleVoid() {
    const reason = window.prompt("Why is this invoice being voided?");
    if (reason && reason.trim().length >= 3)
      act("void", { reason: reason.trim() });
    else if (reason !== null)
      setActionError(
        "Give a reason of at least 3 characters to void an invoice",
      );
  }

  if (error)
    return <ErrorState title="Could not load invoice" message={error} />;
  if (!invoice) return <LoadingState message="Loading invoice..." />;

  const currency = invoice.hospital.currency;
  const money = (value: string) => formatMoney(value, currency);
  const paidPayments = invoice.payments.filter((p) => p.status === "SUCCEEDED");
  const canPay =
    PAYABLE.includes(invoice.status) && Number(invoice.balance) > 0;
  const canVoid =
    invoice.status !== "VOID" &&
    invoice.status !== "PAID" &&
    paidPayments.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/dashboard/billing"
        className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Back to billing
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="font-mono text-xl font-bold text-slate-900">
              {invoice.invoiceNumber}
            </h2>
            <InvoiceStatusBadge invoice={invoice} />
          </div>
          <p className="mt-2 text-sm text-slate-700">
            {invoice.patient.firstName} {invoice.patient.lastName}{" "}
            <span className="font-mono text-xs text-slate-500">
              {invoice.patient.patientNumber}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {invoice.issuedAt
              ? `Issued ${formatDate(invoice.issuedAt)}`
              : `Drafted ${formatDate(invoice.createdAt)}`}
            {invoice.dueDate && ` · Due ${formatDate(invoice.dueDate)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {invoice.status === "DRAFT" && (
            <button
              type="button"
              disabled={busy}
              onClick={handleIssue}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Issue invoice
            </button>
          )}
          {canPay && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setShowPayment(true)}
              className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
            >
              Record payment
            </button>
          )}
          {canVoid && (
            <button
              type="button"
              disabled={busy}
              onClick={handleVoid}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Void
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          {actionError}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-3 font-medium">Item</th>
              <th className="px-5 py-3 text-right font-medium">Qty</th>
              <th className="px-5 py-3 text-right font-medium">Unit price</th>
              <th className="px-5 py-3 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {invoice.items.map((item) => (
              <tr key={item.id}>
                <td className="px-5 py-3 text-slate-900">{item.description}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                  {item.quantity}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                  {money(item.unitPrice)}
                </td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-900">
                  {money(item.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <dl className="space-y-1.5 border-t border-slate-200 px-5 py-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <dt>Subtotal</dt>
            <dd className="tabular-nums">{money(invoice.subtotal)}</dd>
          </div>
          {Number(invoice.taxAmount) > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Tax</dt>
              <dd className="tabular-nums">{money(invoice.taxAmount)}</dd>
            </div>
          )}
          {Number(invoice.discountAmount) > 0 && (
            <div className="flex justify-between text-slate-600">
              <dt>Discount</dt>
              <dd className="tabular-nums">−{money(invoice.discountAmount)}</dd>
            </div>
          )}
          <div className="flex justify-between pt-1 font-semibold text-slate-900">
            <dt>Total</dt>
            <dd className="tabular-nums">{money(invoice.totalAmount)}</dd>
          </div>
          <div className="flex justify-between text-slate-600">
            <dt>Paid</dt>
            <dd className="tabular-nums">{money(invoice.amountPaid)}</dd>
          </div>
          {invoice.status !== "VOID" && (
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-bold text-slate-900">
              <dt>Balance due</dt>
              <dd className="tabular-nums">{money(invoice.balance)}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-semibold text-slate-900">Payments</h3>
        {paidPayments.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {paidPayments.map((payment) => (
              <li
                key={payment.id}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {humanize(payment.method)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {payment.paidAt &&
                      `${formatDate(payment.paidAt)} at ${formatTime(payment.paidAt)}`}
                    {payment.providerReference &&
                      ` · Ref ${payment.providerReference}`}
                  </p>
                </div>
                <p className="font-semibold tabular-nums text-emerald-700">
                  {money(payment.amount)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invoice.notes && (
        <p className="whitespace-pre-line rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          {invoice.notes}
        </p>
      )}

      {showPayment && (
        <PaymentDialog
          balance={invoice.balance}
          currency={currency}
          onClose={() => setShowPayment(false)}
          onSubmit={async (payment) => {
            setInvoice(
              await authRequest<Invoice>(`${url}/payments`, {
                method: "POST",
                body: payment,
              }),
            );
            setShowPayment(false);
          }}
        />
      )}
    </div>
  );
}
