import { OmitType, PartialType } from "@nestjs/mapped-types";
import { CreateMedicalRecordDto } from "./create-medical-record.dto";

// Patient and appointment are fixed once a record exists.
export class UpdateMedicalRecordDto extends PartialType(
  OmitType(CreateMedicalRecordDto, ["patientId", "appointmentId"] as const),
) {}
