export type InvoiceStatus =
  | "DRAFT"
  | "ISSUED"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERDUE"
  | "VOID";
export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "ONLINE"
  | "INSURANCE"
  | "OTHER";

export type InvoiceItem = {
  id: string;
  description: string;
  quantity: number;
  unitPrice: string;
  amount: string;
};

export type Payment = {
  id: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  providerReference: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
};

// Every money field is a string ("21000.00"): the API sends Decimals as text so nothing is rounded.
export type Invoice = {
  id: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  amountPaid: string;
  balance: string;
  isOverdue: boolean;
  dueDate: string | null;
  issuedAt: string | null;
  notes: string | null;
  createdAt: string;
  items: InvoiceItem[];
  payments: Payment[];
  patient: {
    id: string;
    patientNumber: string;
    firstName: string;
    lastName: string;
    phone: string | null;
  };
  hospital: { name: string; currency: string };
};

export type BillingPatient = {
  id: string;
  patientNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};
