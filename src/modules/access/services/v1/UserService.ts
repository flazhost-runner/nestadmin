import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../models/user.entity';
import { Role } from '../../models/role.entity';
import { IUserService } from './IUserService';
import {
  paginate,
  ciLike,
  removePrefix,
  removeEmptyFields,
  generateCode,
} from '../../../../helpers/functions';
import { AppError, NotFoundError } from '../../../../errors/AppError';

const TIMEZONES = [
  'UTC',
  'Asia/Jakarta',
  'Asia/Makassar',
  'Asia/Jayapura',
  'Asia/Singapore',
  'Asia/Kuala_Lumpur',
  'Asia/Bangkok',
  'Asia/Ho_Chi_Minh',
  'Asia/Manila',
  'Asia/Hong_Kong',
  'Asia/Taipei',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Asia/Kolkata',
  'Asia/Karachi',
  'Asia/Dubai',
  'Asia/Riyadh',
  'Africa/Nairobi',
  'Europe/Istanbul',
  'Europe/Moscow',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Sao_Paulo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

@Injectable()
export class UserService implements IUserService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Role) private roleRepo: Repository<Role>,
  ) {}

  async index(filter: any) {
    const clean = removePrefix(filter, 'q_');
    let query = this.userRepo
      .createQueryBuilder('users')
      .leftJoinAndSelect('users.roles', 'roles');

    if (clean.code)
      query = query.andWhere(...ciLike('users.code', 'code', clean.code));
    if (clean.name)
      query = query.andWhere(...ciLike('users.name', 'name', clean.name));
    if (clean.phone)
      query = query.andWhere(...ciLike('users.phone', 'phone', clean.phone));
    if (clean.email)
      query = query.andWhere(...ciLike('users.email', 'email', clean.email));
    if (clean.status)
      query = query.andWhere('users.status = :status', {
        status: clean.status,
      });
    if (clean.role)
      query = query.andWhere('roles.id = :roles_id', { roles_id: clean.role });

    const result = await paginate(query, clean);
    const roles = await this.roleRepo.find();
    return { ...result, roles };
  }

  async create() {
    const roles = await this.roleRepo.find();
    return { roles, timezones: TIMEZONES };
  }

  async store(request: any, files: any = null) {
    const id = uuidv4();
    const roles = await this.roleRepo.findBy({
      id: In(
        Array.isArray(request['roles[]'])
          ? request['roles[]']
          : request.roles || [],
      ),
    });
    if (!roles.length) {
      throw new NotFoundError('Roles Not Found');
    }
    // file upload placeholder — extend when multer/s3 is wired
    if (Array.isArray(files) && files.length > 0) {
      request.picture = files[0]?.filename ?? null;
    }
    const clean = removeEmptyFields({ ...request, id });
    if (!clean.code) clean.code = generateCode('USR');
    clean.password = await bcrypt.hash(clean.password, 10);
    const user = this.userRepo.create({ ...clean, roles });
    const result = await this.userRepo.save(user);
    if (!result) throw new AppError('Store User Fail', 500);
    return result;
  }

  async edit(id: string) {
    const roles = await this.roleRepo.find();
    const data = await this.userRepo.findOne({
      where: { id },
      relations: { roles: true },
    });
    return { data, roles, timezones: TIMEZONES };
  }

  async update(id: string, request: any, files: any = null) {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) throw new NotFoundError('User not found');
    const roles = await this.roleRepo.findBy({
      id: In(
        Array.isArray(request['roles[]'])
          ? request['roles[]']
          : request.roles || [],
      ),
    });
    if (!roles.length) throw new NotFoundError('Roles Not Found');
    if (Array.isArray(files) && files.length > 0) {
      request.picture = files[0]?.filename ?? null;
    }
    const clean = removeEmptyFields(request);
    if (clean.password) clean.password = await bcrypt.hash(clean.password, 10);
    else delete clean.password;
    const data = this.userRepo.merge(user, { ...clean, roles });
    const result = await this.userRepo.save(data);
    if (!result) throw new AppError('Update User Fail', 500);
    return result;
  }

  async delete(id: string) {
    const data = await this.userRepo.findOne({ where: { id } });
    if (!data) throw new NotFoundError('User not found');
    return this.userRepo.remove(data);
  }

  async deleteSelected(ids: string[]) {
    if (!ids?.length) return [];
    const users = await this.userRepo.findBy({ id: In(ids) });
    return this.userRepo.remove(users);
  }
}
