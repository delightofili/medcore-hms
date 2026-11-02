import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HospitalsModule } from "./hospitals/hospitals.module";
import { DepartmentsModule } from "./departments/departments.module";
import { StaffModule } from "./staff/staff.module";
import { PatientsModule } from "./patients/patients.module";
import { AvailabilityModule } from "./availability/availability.module";
import { AppointmentsModule } from "./appointments/appointments.module";
import { ClinicalModule } from "./clinical/clinical.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: "../../.env",
    }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    HospitalsModule,
    DepartmentsModule,
    StaffModule,
    PatientsModule,
    AvailabilityModule,
    AppointmentsModule,
    ClinicalModule,
  ],
})
export class AppModule {}
