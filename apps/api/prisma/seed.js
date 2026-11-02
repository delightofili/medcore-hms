const {
  PrismaClient,
  UserRole,
  AccountStatus,
  Gender,
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

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const hospital = await prisma.hospital.upsert({
    where: { slug: "medcore-general-hospital" },
    update: { isActive: true },
    create: {
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

  await upsertUser(passwordHash, {
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

  await upsertDoctor(
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

  await upsertDoctor(
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

  for (const [
    index,
    [firstName, lastName, dob, gender, bloodGroup, phone],
  ] of patients.entries()) {
    const patientNumber = `MC-DEMO-${String(index + 1).padStart(4, "0")}`;
    await prisma.patient.upsert({
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
  }

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
