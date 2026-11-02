import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { ClinicalAccessService } from "./clinical-access.service";
import { MedicalRecordsController } from "./medical-records.controller";
import { MedicalRecordsService } from "./medical-records.service";
import { PrescriptionsController } from "./prescriptions.controller";
import { PrescriptionsService } from "./prescriptions.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MedicalRecordsController, PrescriptionsController],
  providers: [
    ClinicalAccessService,
    MedicalRecordsService,
    PrescriptionsService,
  ],
})
export class ClinicalModule {}
