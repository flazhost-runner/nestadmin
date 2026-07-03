import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Role } from '../../models/role.entity';
import { Permission } from '../../models/permission.entity';
import { IRoleService } from './IRoleService';
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

@Injectable()
export class RoleService implements IRoleService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission)
    private permissionRepo: Repository<Permission>,
  ) {}

  async index(filter: any) {
    const clean = removePrefix(filter, 'q_');
    let query = this.roleRepo.createQueryBuilder('roles');

    if (clean.name)
      query = query.andWhere(...ciLike('roles.name', 'name', clean.name));
    if (clean.desc)
      query = query.andWhere(...ciLike('roles.desc', 'desc', clean.desc));
    if (clean.status)
      query = query.andWhere('roles.status = :status', {
        status: clean.status,
      });

    return paginate(query, clean);
  }

  async store(request: any) {
    const find = await this.roleRepo.findOne({ where: { name: request.name } });
    if (find) throw new ConflictError('Role Already Exists');
    const clean = removeEmptyFields(request);
    const data = this.roleRepo.create({ ...clean });
    const result = await this.roleRepo.save(data);
    if (!result) throw new AppError('Store Role Fail', 500);
    return result;
  }

  async edit(id: string) {
    return this.roleRepo.findOne({ where: { id } });
  }

  async update(id: string, request: any) {
    const conflict = await this.roleRepo.findOne({
      where: { id: Not(id), name: request.name },
    });
    if (conflict) throw new ConflictError('Role Already Exists');
    const role = await this.roleRepo.findOne({ where: { id } });
    if (!role) throw new NotFoundError('Role not found');
    const clean = removeEmptyFields(request);
    const data = this.roleRepo.merge(role, { ...clean });
    const result = await this.roleRepo.save(data);
    if (!result) throw new AppError('Update Role Fail', 500);
    return result;
  }

  async delete(id: string) {
    const data = await this.roleRepo.findOne({ where: { id } });
    if (!data) throw new NotFoundError('Role not found');
    return this.roleRepo.remove(data);
  }

  async deleteSelected(ids: string[]) {
    if (!ids?.length) return [];
    const roles = await this.roleRepo.findBy({ id: In(ids) });
    return this.roleRepo.remove(roles);
  }

  async permission(role_id: string, filter: any) {
    const clean = removePrefix(filter, 'q_');
    const role = await this.roleRepo.findOne({
      where: { id: role_id },
      relations: { permissions: true },
    });
    let query = this.permissionRepo.createQueryBuilder('permissions');

    if (clean.name)
      query = query.andWhere(...ciLike('permissions.name', 'name', clean.name));
    if (clean.method)
      query = query.andWhere('permissions.method = :method', {
        method: clean.method,
      });
    if (clean.desc)
      query = query.andWhere(...ciLike('permissions.desc', 'desc', clean.desc));
    if (clean.status) {
      if (clean.status === 'Active') {
        // Only assigned permissions
        query = query
          .innerJoin('permissions.roles', 'r')
          .andWhere('r.id = :role_id', { role_id });
      } else if (clean.status === 'Inactive') {
        // Only unassigned permissions
        query = query
          .where((qb) => {
            const sub = qb
              .subQuery()
              .select('rp.permission_id')
              .from('roles_permissions', 'rp')
              .where('rp.role_id = :roleId')
              .getQuery();
            return `permissions.id NOT IN ${sub}`;
          })
          .setParameter('roleId', role_id);
      }
    }

    const result = await paginate(query, clean);
    return { ...result, role };
  }

  async permissionAssign(role_id: string, permission_id: string) {
    const role = await this.roleRepo.findOne({
      where: { id: role_id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundError('Role not found');
    const permission = await this.permissionRepo.findOne({
      where: { id: permission_id },
    });
    if (!permission) throw new NotFoundError('Permission not found');
    if (!role.permissions.some((p) => p.id === permission_id)) {
      role.permissions.push(permission);
    }
    const result = await this.roleRepo.save(role);
    if (!result) throw new AppError('Assign Permission Fail', 500);
    return result;
  }

  async permissionAssignSelected(role_id: string, permissions: string[]) {
    const role = await this.roleRepo.findOne({
      where: { id: role_id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundError('Role not found');
    const found = await this.permissionRepo.findBy({ id: In(permissions) });
    const existingIds = new Set(role.permissions.map((p) => p.id));
    for (const perm of found) {
      if (!existingIds.has(perm.id)) role.permissions.push(perm);
    }
    const result = await this.roleRepo.save(role);
    if (!result) throw new AppError('Assign Permission Fail', 500);
    return result;
  }

  async permissionUnassign(role_id: string, permission_id: string) {
    const role = await this.roleRepo.findOne({
      where: { id: role_id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundError('Role not found');
    role.permissions = role.permissions.filter((p) => p.id !== permission_id);
    const result = await this.roleRepo.save(role);
    if (!result) throw new AppError('Unassign Permission Fail', 500);
    return result;
  }

  async permissionUnassignSelected(role_id: string, permissions: string[]) {
    const role = await this.roleRepo.findOne({
      where: { id: role_id },
      relations: { permissions: true },
    });
    if (!role) throw new NotFoundError('Role not found');
    role.permissions = role.permissions.filter(
      (p) => !permissions.includes(p.id),
    );
    const result = await this.roleRepo.save(role);
    if (!result) throw new AppError('Unassign Permission Fail', 500);
    return result;
  }
}
