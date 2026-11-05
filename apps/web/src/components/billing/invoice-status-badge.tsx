import { humanize } from "@/lib/format";
import type { Invoice, InvoiceStatus } from "@/types/billing";

const styles: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ISSUED: "bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-800",
  PAID: "bg-emerald-50 text-emerald-700",
  OVERDUE: "bg-red-50 text-red-700",
  VOID: "bg-slate-100 text-slate-400 line-through",
};

export function InvoiceStatusBadge({
  invoice,
}: {
  invoice: Pick<Invoice, "status" | "isOverdue">;
}) {
  // Overdue is computed by the API, so it is shown on top of the stored status.
  const status: InvoiceStatus = invoice.isOverdue ? "OVERDUE" : invoice.status;
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styles[status]}`}
    >
      {humanize(status)}
    </span>
  );
}
