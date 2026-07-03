import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { routeRegistry } from '../../../utils/named-routes';
import { ForbiddenError } from '../../../errors/AppError';

export const ROLES_KEY = 'roles';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user: any = req.session?.user || req.user;

    if (!user) return false;

    // Administrator bypasses all checks
    const isAdmin = user.roles?.some((r: any) => r.name === 'Administrator');
    if (isAdmin) return true;

    // Route-driven RBAC: derive (name, method) from current request
    const method = req.method.toUpperCase();
    const path = req.route?.path || req.path;
    const routeName = routeRegistry.getNameByPathAndMethod(path, method);

    if (!routeName) return true; // unregistered route = allow

    // Check if any of user's roles has permission with matching name+method
    // This requires permission data on user - loaded by auth service
    const permissions: any[] = user.permissions || [];
    const hasAccess = permissions.some(
      (p: any) => p.name === routeName && p.method === method,
    );

    if (!hasAccess) throw new ForbiddenError('Access denied');
    return true;
  }
}
