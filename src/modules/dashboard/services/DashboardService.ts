import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../access/models/user.entity';
import { Role } from '../../access/models/role.entity';
import { Permission } from '../../access/models/permission.entity';

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(Permission) private permRepo: Repository<Permission>,
  ) {}

  async getStats(): Promise<{
    users: number;
    roles: number;
    permissions: number;
  }> {
    const [users, roles, permissions] = await Promise.all([
      this.userRepo.count(),
      this.roleRepo.count(),
      this.permRepo.count(),
    ]);
    return { users, roles, permissions };
  }
}
