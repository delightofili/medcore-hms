import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";
import {
  AuthenticatedUser,
  CurrentUser,
} from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { DashboardService } from "./dashboard.service";

@Controller("hospitals/:hospitalId/dashboard")
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  getSummary(
    @CurrentUser() user: AuthenticatedUser,
    @Param("hospitalId", ParseUUIDPipe) hospitalId: string,
  ) {
    return this.dashboard.getSummary(user.id, hospitalId);
  }
}
