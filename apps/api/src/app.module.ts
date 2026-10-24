import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "./auth/auth.module";
import { DatabaseModule } from "./database/database.module";
import { HealthModule } from "./health/health.module";
import { HospitalsModule } from "./hospitals/hospitals.module";
import { DepartmentsModule } from "./departments/departments.module";
import { StaffModule } from "./staff/staff.module";

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
  ],
})
export class AppModule {}
