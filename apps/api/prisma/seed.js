/* eslint-disable */
// MedCore HMS demo seed. Run from the repository root:
//   node --env-file=.env apps/api/prisma/seed.js
// Safe to run more than once: every record is upserted.

const {
  PrismaClient,
  UserRole,
  AccountStatus,
  Gender,
  AppointmentStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
} = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "MedCoreDev2026!";

async function upsertUser(passwordHash, data) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      role: data.role,
      hospitalId: data.hospitalId,
      status: AccountStatus.ACTIVE,
      passwordHash,
      deletedAt: null,
    },
    create: {
      ...data,
      passwordHash,
      status: AccountStatus.ACTIVE,
      emailVerificationRequired: false,
      emailVerifiedAt: new Date(),
    },
  });
}

async function upsertDoctor(userId, hospitalId, departmentId, profile) {
  const doctor = await prisma.doctor.upsert({
    where: { userId },
    update: { departmentId, ...profile, isAvailable: true, deletedAt: null },
    create: { userId, hospitalId, departmentId, ...profile },
  });

  // Monday (1) to Friday (5), 09:00 to 17:00, 30 minute slots
  await prisma.doctorAvailability.deleteMany({
    where: { doctorId: doctor.id },
  });
  await prisma.doctorAvailability.createMany({
    data: [1, 2, 3, 4, 5].map((dayOfWeek) => ({
      doctorId: doctor.id,
      dayOfWeek,
      startTime: "09:00",
      endTime: "17:00",
      slotMinutes: 30,
    })),
  });

  return doctor;
}

// Today if it is a weekday, otherwise the next Monday, so seeded slots are bookable times.
function demoDay() {
  const day = new Date();
  day.setHours(0, 0, 0, 0);
  while (day.getDay() === 0 || day.getDay() === 6)
    day.setDate(day.getDate() + 1);
  return day;
}

function at(day, hours, minutes) {
  const date = new Date(day);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

async function seedDemoActivity({
  hospital,
  doctors,
  patients,
  receptionist,
  accountant,
}) {
  const [chidi, funmi, ibrahim, blessing, kelechi] = patients;
  const day = demoDay();

  // A realistic morning queue. Skipped if that doctor already has something at that time.
  const queue = [
    [
      doctors.okafor,
      chidi,
      9,
      0,
      AppointmentStatus.CHECKED_IN,
      "Persistent cough for two weeks",
    ],
    [
      doctors.okafor,
      funmi,
      9,
      30,
      AppointmentStatus.CONFIRMED,
      "Follow up on blood pressure",
    ],
    [
      doctors.okafor,
      blessing,
      10,
      0,
      AppointmentStatus.SCHEDULED,
      "Joint pain",
    ],
    [
      doctors.eze,
      ibrahim,
      9,
      0,
      AppointmentStatus.CHECKED_IN,
      "Fever and vomiting",
    ],
    [doctors.eze, kelechi, 11, 0, AppointmentStatus.SCHEDULED, "Routine check"],
  ];

  for (const [doctor, patient, hours, minutes, status, reason] of queue) {
    const appointmentAt = at(day, hours, minutes);
    const taken = await prisma.appointment.findFirst({
      where: { doctorId: doctor.id, appointmentAt, deletedAt: null },
      select: { id: true },
    });
    if (taken) continue;

    await prisma.appointment.create({
      data: {
        hospitalId: hospital.id,
        patientId: patient.id,
        doctorId: doctor.id,
        departmentId: doctor.departmentId,
        createdById: receptionist.id,
        appointmentAt,
        durationMinutes: 30,
        status,
        reason,
        checkedInAt:
          status === AppointmentStatus.CHECKED_IN ? new Date() : null,
      },
    });
  }

  // Invoices in each billing state. Keyed by invoice number, so they are created once.
  const lastWeek = new Date(day);
  lastWeek.setDate(lastWeek.getDate() - 7);

  const invoices = [
    {
      invoiceNumber: "INV-DEMO-0001",
      patient: chidi,
      status: InvoiceStatus.PAID,
      items: [
        ["General consultation", 1, 15000],
        ["Chest X-ray", 1, 8000],
      ],
      payments: [[23000, PaymentMethod.CASH]],
    },
    {
      invoiceNumber: "INV-DEMO-0002",
      patient: blessing,
      status: InvoiceStatus.PARTIALLY_PAID,
      items: [
        ["General consultation", 1, 15000],
        ["Full blood count", 1, 4500],
      ],
      payments: [[10000, PaymentMethod.BANK_TRANSFER]],
    },
    {
      invoiceNumber: "INV-DEMO-0003",
      patient: kelechi,
      status: InvoiceStatus.ISSUED,
      dueDate: lastWeek,
      items: [["Paediatric consultation", 1, 20000]],
      payments: [],
    },
  ];

  for (const invoice of invoices) {
    const exists = await prisma.invoice.findUnique({
      where: {
        hospitalId_invoiceNumber: {
          hospitalId: hospital.id,
          invoiceNumber: invoice.invoiceNumber,
        },
      },
      select: { id: true },
    });
    if (exists) continue;

    const total = invoice.items.reduce(
      (sum, [, qty, price]) => sum + qty * price,
      0,
    );

    await prisma.invoice.create({
      data: {
        hospitalId: hospital.id,
        patientId: invoice.patient.id,
        createdById: accountant.id,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        subtotal: total,
        totalAmount: total,
        issuedAt: new Date(),
        dueDate: invoice.dueDate ?? null,
        items: {
          create: invoice.items.map(([description, quantity, unitPrice]) => ({
            description,
            quantity,
            unitPrice,
            amount: quantity * unitPrice,
          })),
        },
        payments: {
          create: invoice.payments.map(([amount, method]) => ({
            amount,
            method,
            currency: hospital.currency,
            status: PaymentStatus.SUCCEEDED,
            recordedById: accountant.id,
            paidAt: new Date(),
          })),
        },
      },
    });
  }
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const hospital = await prisma.hospital.upsert({
    where: { slug: "medcore-general-hospital" },
    update: { isActive: true, currency: "NGN", timezone: "Africa/Lagos" },
    create: {
      currency: "NGN",
      timezone: "Africa/Lagos",
      name: "MedCore General Hospital",
      slug: "medcore-general-hospital",
      email: "info@medcore.test",
      phone: "+2348000000000",
      registrationNumber: "MCGH-2026-001",
    },
  });

  const [generalMedicine, paediatrics] = await Promise.all(
    ["General Medicine", "Paediatrics"].map((name) =>
      prisma.department.upsert({
        where: { hospitalId_name: { hospitalId: hospital.id, name } },
        update: { isActive: true },
        create: { hospitalId: hospital.id, name },
      }),
    ),
  );

  const superAdminHash = process.env.SEED_SUPERADMIN_PASSWORD
    ? await bcrypt.hash(process.env.SEED_SUPERADMIN_PASSWORD, 12)
    : passwordHash;

  await upsertUser(superAdminHash, {
    email: "superadmin@medcore.test",
    firstName: "Chukwunonso",
    lastName: "Ofili",
    role: UserRole.SUPER_ADMIN,
    hospitalId: null,
  });

  const staff = [
    ["admin@medcore.test", "Ada", "Nwosu", UserRole.HOSPITAL_ADMIN],
    ["doctor@medcore.test", "Emeka", "Okafor", UserRole.DOCTOR],
    ["doctor2@medcore.test", "Ngozi", "Eze", UserRole.DOCTOR],
    ["reception@medcore.test", "Tobi", "Adeyemi", UserRole.RECEPTIONIST],
    ["nurse@medcore.test", "Amaka", "Obi", UserRole.NURSE],
    ["accountant@medcore.test", "Musa", "Bello", UserRole.ACCOUNTANT],
    ["pharmacist@medcore.test", "Zainab", "Yusuf", UserRole.PHARMACIST],
  ];

  const users = {};
  for (const [email, firstName, lastName, role] of staff) {
    users[email] = await upsertUser(passwordHash, {
      email,
      firstName,
      lastName,
      role,
      hospitalId: hospital.id,
    });
  }

  const okafor = await upsertDoctor(
    users["doctor@medcore.test"].id,
    hospital.id,
    generalMedicine.id,
    {
      licenseNumber: "MDCN-10021",
      specialization: "General Practice",
      qualification: "MBBS",
      consultationFee: 15000,
    },
  );

  const eze = await upsertDoctor(
    users["doctor2@medcore.test"].id,
    hospital.id,
    paediatrics.id,
    {
      licenseNumber: "MDCN-10022",
      specialization: "Paediatrics",
      qualification: "MBBS, FWACP",
      consultationFee: 20000,
    },
  );

  const patients = [
    ["Chidi", "Anozie", "1990-04-12", Gender.MALE, "O+", "08031110001"],
    ["Funmi", "Bakare", "1985-09-30", Gender.FEMALE, "A+", "08031110002"],
    ["Ibrahim", "Sani", "2015-01-21", Gender.MALE, "B+", "08031110003"],
    ["Blessing", "Okon", "1978-12-05", Gender.FEMALE, "AB+", "08031110004"],
    ["Kelechi", "Umeh", "2001-07-18", Gender.MALE, "O-", "08031110005"],
  ];

  const demoPatients = [];
  for (const [
    index,
    [firstName, lastName, dob, gender, bloodGroup, phone],
  ] of patients.entries()) {
    const patientNumber = `MC-DEMO-${String(index + 1).padStart(4, "0")}`;
    const patient = await prisma.patient.upsert({
      where: {
        hospitalId_patientNumber: { hospitalId: hospital.id, patientNumber },
      },
      update: { deletedAt: null },
      create: {
        hospitalId: hospital.id,
        patientNumber,
        firstName,
        lastName,
        dateOfBirth: new Date(dob),
        gender,
        bloodGroup,
        phone,
        city: "Enugu",
        country: "Nigeria",
      },
    });
    demoPatients.push(patient);
  }

  await seedDemoActivity({
    hospital,
    doctors: { okafor, eze },
    patients: demoPatients,
    receptionist: users["reception@medcore.test"],
    accountant: users["accountant@medcore.test"],
  });

  console.log("Seed complete");
  console.log(`Hospital: ${hospital.name} (${hospital.id})`);
  console.log(`All demo accounts use the password: ${DEMO_PASSWORD}`);
  console.log(
    ["superadmin", ...staff.map(([e]) => e.split("@")[0])]
      .map((n) => `  ${n}@medcore.test`)
      .join("\n"),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
