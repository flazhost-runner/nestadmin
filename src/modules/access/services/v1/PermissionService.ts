import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Permission } from '../../models/permission.entity';
import { IPermissionService } from './IPermissionService';
import {
  paginate,
  ciLike,
  removePrefix,
  removeEmptyFields,
} from '../../../../helpers/functions';
import {
  AppError,
  ConflictError,
  NotFoundError,
} from '../../../../errors/AppError';
import { routeRegistry } from '../../../../utils/named-routes';

@Injectable()
export class PermissionService implements IPermissionService {
  constructor(
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  /**
   * Auto-discover permission dari named routes — paritas NodeAdmin
   * (getAllRegisteredRoute) & GoAdmin: setiap route terdaftar di routeRegistry
   * di-upsert jadi row permission (idempoten). Dipanggil saat halaman
   * Permission Management dibuka, jadi route baru otomatis muncul.
   */
  async syncFromRouteRegistry(): Promise<void> {
    for (const route of routeRegistry.getAll()) {
      const existing = await this.permissionRepo.findOne({
        where: {
          name: route.name,
          method: route.method,
          guard_name: route.guardName,
        },
      });
      if (existing) continue;
      await this.permissionRepo.save(
        this.permissionRepo.create({
          name: route.name,
          method: route.method,
          guard_name: route.guardName,
        }),
      );
    }
  }

  async index(filter: any) {
    const clean = removePrefix(filter, 'q_');
    let query = this.permissionRepo.createQueryBuilder('permissions');

    if (clean.name)
      query = query.andWhere(...ciLike('permissions.name', 'name', clean.name));
    if (clean.method)
      query = query.andWhere('permissions.method = :method', {
        method: clean.method,
      });
    if (clean.status)
      query = query.andWhere('permissions.status = :status', {
        status: clean.status,
      });
    if (clean.guard)
      query = query.andWhere('permissions.guard_name = :guard', {
        guard: clean.guard,
      });
    if (clean.guard_name)
      query = query.andWhere('permissions.guard_name = :guard_name', {
        guard_name: clean.guard_name,
      });
    if (clean.desc)
      query = query.andWhere(...ciLike('permissions.desc', 'desc', clean.desc));

    return paginate(query, clean);
  }

  async store(request: any) {
    const find = await this.permissionRepo.findOne({
      where: { name: request.name },
    });
    if (find) throw new ConflictError('Permission Already Exists');
    const clean = removeEmptyFields(request);
    const data = this.permissionRepo.create({ ...clean });
    const result = await this.permissionRepo.save(data);
    if (!result) throw new AppError('Store Permission Fail', 500);
    return result;
  }

  async edit(id: string) {
    return this.permissionRepo.findOne({ where: { id } });
  }

  async update(id: string, request: any) {
    const conflict = await this.permissionRepo.findOne({
      where: { id: Not(id), name: request.name },
    });
    if (conflict) throw new ConflictError('Permission Already Exists');
    const permission = await this.permissionRepo.findOne({ where: { id } });
    if (!permission) throw new NotFoundError('Permission not found');
    const clean = removeEmptyFields(request);
    const data = this.permissionRepo.merge(permission, { ...clean });
    const result = await this.permissionRepo.save(data);
    if (!result) throw new AppError('Update Permission Fail', 500);
    return result;
  }

  async delete(id: string) {
    const data = await this.permissionRepo.findOne({ where: { id } });
    if (!data) throw new NotFoundError('Permission not found');
    return this.permissionRepo.remove(data);
  }

  async deleteSelected(ids: string[]) {
    if (!ids?.length) return [];
    const perms = await this.permissionRepo.findBy({ id: In(ids) });
    return this.permissionRepo.remove(perms);
  }

  /** Sync all named routes from routeRegistry into the permissions table. */
  async syncFromRoutes() {
    const routes = routeRegistry.getAll();
    for (const route of routes) {
      const existing = await this.permissionRepo.findOne({
        where: {
          name: route.name,
          method: route.method,
          guard_name: route.guardName,
        },
      });
      if (!existing) {
        const perm = this.permissionRepo.create({
          name: route.name,
          method: route.method,
          guard_name: route.guardName,
          status: 'Active',
        });
        await this.permissionRepo.save(perm);
      }
    }
  }
}
