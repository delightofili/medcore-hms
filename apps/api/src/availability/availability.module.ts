import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DatabaseModule } from "../database/database.module";
import { AvailabilityController } from "./availability.controller";
import { AvailabilityService } from "./availability.service";

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
})
export class AvailabilityModule {}
