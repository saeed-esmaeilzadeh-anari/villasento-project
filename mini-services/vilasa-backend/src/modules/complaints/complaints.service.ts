import { Injectable } from "@nestjs/common";

import { PrismaService } from "../../prisma/prisma.service";
import { badRequest } from "../../common/api-error";

@Injectable()
export class ComplaintsService {
  constructor(private prisma: PrismaService) {}

  async createComplaint(userId: string, data: { bookingId?: string; subject: string; body: string }) {
    if (!data.subject?.trim()) throw badRequest("موضوع را وارد کنید");
    return this.prisma.complaint.create({
      data: {
        userId,
        bookingId: data.bookingId || null,
        subject: data.subject,
        body: data.body,
      },
    });
  }
}
