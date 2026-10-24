import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import { CreateHospitalDto } from "./dto/create-hospital.dto";

@Injectable()
export class HospitalsService {
  constructor(private readonly prisma: PrismaService) {}

  private createSlug(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  async create(dto: CreateHospitalDto) {
    const name = dto.name.trim();
    const baseSlug = this.createSlug(name);

    if (!baseSlug) {
      throw new ConflictException(
        "A valid hospital name is required to generate a slug",
      );
    }

    let slug = baseSlug;
    let suffix = 1;

    // Avoid using a slug that already belongs to another hospital.
    while (
      await this.prisma.hospital.findFirst({
        where: { slug },
        select: { id: true },
      })
    ) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const hospital = await this.prisma.hospital.create({
      data: {
        name,
        slug,
      },
    });

    return {
      message: "Hospital created successfully",
      hospital,
    };
  }

  async findAll() {
    return this.prisma.hospital.findMany({
      orderBy: {
        name: "asc",
      },
    });
  }

  async findOne(hospitalId: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: {
        id: hospitalId,
      },
    });

    if (!hospital) {
      throw new NotFoundException("Hospital not found");
    }

    return hospital;
  }
}
