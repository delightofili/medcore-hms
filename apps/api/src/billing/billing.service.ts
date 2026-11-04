import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvoiceStatus, PaymentStatus, Prisma, UserRole } from "@prisma/client";
import { randomBytes } from "crypto";
import { PrismaService } from "../database/prisma.service";
import { TenantAccessService } from "../auth/tenant-access.service";
import {
  CreateInvoiceDto,
  InvoiceDetailsDto,
  ListInvoicesDto,
  RecordPaymentDto,
  VoidInvoiceDto,
} from "./dto/invoice.dto";

const { Decimal } = Prisma;
type Money = Prisma.Decimal;

const BILLING_ROLES = new Set<UserRole>([
  UserRole.SUPER_ADMIN,
  UserRole.HOSPITAL_ADMIN,
  UserRole.ACCOUNTANT,
  UserRole.RECEPTIONIST,
]);

const PAYABLE_STATUSES: InvoiceStatus[] = [
  InvoiceStatus.ISSUED,
  InvoiceStatus.PARTIALLY_PAID,
  InvoiceStatus.OVERDUE,
];

const invoiceInclude = {
  items: { orderBy: { createdAt: "asc" } },
  payments: { orderBy: { createdAt: "asc" } },
  patient: {
    select: {
      id: true,
      patientNumber: true,
      firstName: true,
      lastName: true,
      phone: true,
    },
  },
  hospital: { select: { name: true, currency: true } },
} satisfies Prisma.InvoiceInclude;

type InvoiceWithRelations = Prisma.InvoiceGetPayload<{
  include: typeof invoiceInclude;
}>;

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAccess: TenantAccessService,
  ) {}

  private async authorize(actorId: string, hospitalId: string) {
    const actor = await this.tenantAccess.requireHospitalMembership(
      actorId,
      hospitalId,
    );

    if (!BILLING_ROLES.has(actor.role)) {
      throw new ForbiddenException("Your role does not have access to billing");
    }

    return actor;
  }

  private generateInvoiceNumber() {
    const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
    return `INV-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
  }

  /** All money maths uses Decimal: 0.1 + 0.2 must equal 0.3, not 0.30000000000000004. */
  private calculateTotals(dto: InvoiceDetailsDto) {
    const items = dto.items.map((item) => {
      const unitPrice = new Decimal(item.unitPrice);
      return {
        description: item.description.trim(),
        quantity: item.quantity,
        unitPrice,
        amount: unitPrice.mul(item.quantity),
      };
    });

    const subtotal = items.reduce<Money>(
      (sum, item) => sum.add(item.amount),
      new Decimal(0),
    );
    const taxAmount = new Decimal(dto.taxAmount ?? 0);
    const discountAmount = new Decimal(dto.discountAmount ?? 0);
    const totalAmount = subtotal.add(taxAmount).sub(discountAmount);

    if (totalAmount.isNegative()) {
      throw new BadRequestException(
        "Discount cannot be more than the invoice total",
      );
    }

    return { items, subtotal, taxAmount, discountAmount, totalAmount };
  }

  private parseDueDate(value?: string) {
    if (!value) return undefined;
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
      throw new BadRequestException("Invalid due date");
    return date;
  }

  /** Adds amountPaid, balance and isOverdue so the frontend never does money maths. */
  private present(invoice: InvoiceWithRelations) {
    const amountPaid = invoice.payments
      .filter((payment) => payment.status === PaymentStatus.SUCCEEDED)
      .reduce<Money>((sum, payment) => sum.add(payment.amount), new Decimal(0));

    const balance = invoice.totalAmount.sub(amountPaid);
    const isOverdue =
      PAYABLE_STATUSES.includes(invoice.status) &&
      balance.isPositive() &&
      invoice.dueDate !== null &&
      invoice.dueDate < new Date();

    return {
      ...invoice,
      amountPaid: amountPaid.toFixed(2),
      balance: balance.toFixed(2),
      isOverdue,
    };
  }

  private async getInvoice(hospitalId: string, invoiceId: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, hospitalId },
      include: invoiceInclude,
    });

    if (!invoice) throw new NotFoundException("Invoice not found");

    return invoice;
  }

  async create(actorId: string, hospitalId: string, dto: CreateInvoiceDto) {
    const actor = await this.authorize(actorId, hospitalId);

    const patient = await this.prisma.patient.findFirst({
      where: { id: dto.patientId, hospitalId, deletedAt: null },
      select: { id: true },
    });

    if (!patient) throw new NotFoundException("Patient not found");

    const totals = this.calculateTotals(dto);

    const invoice = await this.prisma.invoice.create({
      data: {
        hospitalId,
        patientId: patient.id,
        createdById: actor.id,
        invoiceNumber: this.generateInvoiceNumber(),
        subtotal: totals.subtotal,
        taxAmount: totals.taxAmount,
        discountAmount: totals.discountAmount,
        totalAmount: totals.totalAmount,
        dueDate: this.parseDueDate(dto.dueDate),
        notes: dto.notes?.trim() || null,
        items: { create: totals.items },
      },
      include: invoiceInclude,
    });

    return this.present(invoice);
  }

  async findAll(actorId: string, hospitalId: string, query: ListInvoicesDto) {
    await this.authorize(actorId, hospitalId);

    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Prisma.InvoiceWhereInput = {
      hospitalId,
      ...(query.patientId && { patientId: query.patientId }),
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: invoiceInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      items: items.map((invoice) => this.present(invoice)),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async findOne(actorId: string, hospitalId: string, invoiceId: string) {
    await this.authorize(actorId, hospitalId);
    return this.present(await this.getInvoice(hospitalId, invoiceId));
  }

  /** Drafts can be fully rewritten. Once issued, an invoice is a legal document. */
  async updateDraft(
    actorId: string,
    hospitalId: string,
    invoiceId: string,
    dto: InvoiceDetailsDto,
  ) {
    await this.authorize(actorId, hospitalId);
    const invoice = await this.getInvoice(hospitalId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be edited");
    }

    const totals = this.calculateTotals(dto);

    await this.prisma.$transaction([
      this.prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } }),
      this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          discountAmount: totals.discountAmount,
          totalAmount: totals.totalAmount,
          dueDate: this.parseDueDate(dto.dueDate) ?? null,
          notes: dto.notes?.trim() || null,
          items: { create: totals.items },
        },
      }),
    ]);

    return this.present(await this.getInvoice(hospitalId, invoice.id));
  }

  async issue(actorId: string, hospitalId: string, invoiceId: string) {
    await this.authorize(actorId, hospitalId);
    const invoice = await this.getInvoice(hospitalId, invoiceId);

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException("Only draft invoices can be issued");
    }

    if (!invoice.totalAmount.isPositive()) {
      throw new BadRequestException("An invoice must have a total above zero");
    }

    const result = await this.prisma.invoice.updateMany({
      where: { id: invoice.id, status: InvoiceStatus.DRAFT },
      data: { status: InvoiceStatus.ISSUED, issuedAt: new Date() },
    });

    if (result.count === 0)
      throw new ConflictException("This invoice was already issued");

    return this.present(await this.getInvoice(hospitalId, invoice.id));
  }

  async void(
    actorId: string,
    hospitalId: string,
    invoiceId: string,
    dto: VoidInvoiceDto,
  ) {
    await this.authorize(actorId, hospitalId);
    const invoice = await this.getInvoice(hospitalId, invoiceId);

    if (
      invoice.status === InvoiceStatus.VOID ||
      invoice.status === InvoiceStatus.PAID
    ) {
      throw new BadRequestException(
        `A ${invoice.status.toLowerCase()} invoice cannot be voided`,
      );
    }

    const hasPayments = invoice.payments.some(
      (p) => p.status === PaymentStatus.SUCCEEDED,
    );
    if (hasPayments) {
      throw new BadRequestException(
        "Refund the payments before voiding this invoice",
      );
    }

    const reason = `Voided: ${dto.reason.trim()}`;

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: InvoiceStatus.VOID,
        notes: invoice.notes ? `${invoice.notes}\n${reason}` : reason,
      },
    });

    return this.present(await this.getInvoice(hospitalId, invoice.id));
  }

  async recordPayment(
    actorId: string,
    hospitalId: string,
    invoiceId: string,
    dto: RecordPaymentDto,
  ) {
    const actor = await this.authorize(actorId, hospitalId);

    // A double click sends the same key twice: return the first payment, don't charge twice.
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        select: { invoiceId: true },
      });

      if (existing) {
        if (existing.invoiceId !== invoiceId) {
          throw new ConflictException(
            "This idempotency key was used for another invoice",
          );
        }
        return this.present(await this.getInvoice(hospitalId, invoiceId));
      }
    }

    const amount = new Decimal(dto.amount);

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const invoice = await tx.invoice.findFirst({
            where: { id: invoiceId, hospitalId },
            include: {
              payments: {
                where: { status: PaymentStatus.SUCCEEDED },
                select: { amount: true },
              },
              hospital: { select: { currency: true } },
            },
          });

          if (!invoice) throw new NotFoundException("Invoice not found");

          if (!PAYABLE_STATUSES.includes(invoice.status)) {
            throw new BadRequestException(
              invoice.status === InvoiceStatus.DRAFT
                ? "Issue the invoice before taking payment"
                : `A ${invoice.status.toLowerCase()} invoice cannot take payments`,
            );
          }

          const paid = invoice.payments.reduce<Money>(
            (sum, p) => sum.add(p.amount),
            new Decimal(0),
          );
          const balance = invoice.totalAmount.sub(paid);

          if (amount.greaterThan(balance)) {
            throw new BadRequestException(
              `Payment is more than the outstanding balance of ${balance.toFixed(2)}`,
            );
          }

          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              recordedById: actor.id,
              amount,
              currency: invoice.hospital.currency,
              method: dto.method,
              status: PaymentStatus.SUCCEEDED,
              providerReference: dto.providerReference?.trim() || null,
              idempotencyKey: dto.idempotencyKey,
              notes: dto.notes?.trim() || null,
              paidAt: new Date(),
            },
          });

          const newBalance = balance.sub(amount);

          await tx.invoice.update({
            where: { id: invoice.id },
            data: {
              status: newBalance.isZero()
                ? InvoiceStatus.PAID
                : InvoiceStatus.PARTIALLY_PAID,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2034") {
          throw new ConflictException(
            "Another payment was recorded at the same moment. Refresh and try again.",
          );
        }
        if (error.code === "P2002") {
          throw new ConflictException(
            "This payment reference has already been recorded",
          );
        }
      }
      throw error;
    }

    return this.present(await this.getInvoice(hospitalId, invoiceId));
  }
}
