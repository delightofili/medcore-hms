import { Module } from "@nestjs/common";
import { DatabaseModule } from "../database/database.module";
import { AuthModule } from "../auth/auth.module";
import { HospitalsController } from "./hospitals.controller";
import { HospitalsService } from "./hospitals.service";

@Module({
  imports: [DatabaseModule, AuthModule],
  controllers: [HospitalsController],
  providers: [HospitalsService],
  exports: [HospitalsService],
})
export class HospitalsModule {}
