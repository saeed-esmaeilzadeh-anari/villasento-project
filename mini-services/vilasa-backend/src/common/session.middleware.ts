import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";

import { PrismaService } from "../prisma/prisma.service";
import { decodeSession, extractTokenFromCookies } from "./session.util";

export type SafeUser = {
  id: string;
  phone: string;
  fullName: string | null;
  email: string | null;
  role: string;
  isHostVerified: boolean;
  isBlocked: boolean;
  avatarUrl: string | null;
  nationalId: string | null;
};

/** Express request augmented with the resolved (or null) current user. */
export interface VilasaRequest extends Request {
  vilasaUser?: SafeUser | null;
}

/**
 * Resolves the shared `vilasa_session` HMAC cookie on every request —
 * identical algorithm & secret to the Next.js app → a login performed on
 * either server is automatically valid on the other (SSO).
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware {
  constructor(private prisma: PrismaService) {}

  async use(req: VilasaRequest, _res: Response, next: NextFunction) {
    req.vilasaUser = null;
    const token = extractTokenFromCookies(req.cookies as Record<string, string>);
    if (token) {
      const payload = decodeSession(token);
      if (payload) {
        const user = await this.prisma.user.findUnique({ where: { id: payload.uid } });
        if (user && !user.isBlocked) {
          req.vilasaUser = {
            id: user.id,
            phone: user.phone,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            isHostVerified: user.isHostVerified,
            isBlocked: user.isBlocked,
            avatarUrl: user.avatarUrl,
            nationalId: user.nationalId,
          };
        }
      }
    }
    next();
  }
}
