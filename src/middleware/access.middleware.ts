import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../modules/access/models/user.entity';

@Injectable()
export class AccessMiddleware implements NestMiddleware {
  constructor(@InjectRepository(User) private userRepo: Repository<User>) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const sessionUser = (req.session as any)?.user;
    if (!sessionUser?.id) return next();

    // Determine route name from registered routes
    const routeName: string | undefined = (res.locals as any)._routeName;
    if (!routeName) return next();

    // Fresh DB query — get user with roles and permissions
    let user: User | null = null;
    try {
      user = await this.userRepo.findOne({
        where: { id: sessionUser.id },
        relations: { roles: { permissions: true } },
      });
    } catch {
      return next();
    }

    if (!user) return next();

    // Administrator bypass
    const isAdmin = user.roles?.some((r) => r.name === 'Administrator');
    if (isAdmin) return next();

    // Check permission: route name + HTTP method
    const method = req.method.toUpperCase();
    const allPerms = user.roles?.flatMap((r) => r.permissions || []) || [];
    const allowed = allPerms.some(
      (p) => p.name === routeName && p.method?.toUpperCase() === method,
    );

    if (!allowed) {
      const isApi = req.path.startsWith('/api/');
      if (isApi) {
        return res
          .status(403)
          .json({ status: false, message: 'Forbidden', data: null });
      }
      (req as any).flash?.('error', 'Unauthorized.');
      const referrer = req.get('Referrer') || '/admin/v1/dashboard';
      return res.redirect(referrer);
    }

    next();
  }
}
