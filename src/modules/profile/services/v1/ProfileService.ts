import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as path from 'path';
import * as crypto from 'crypto';
import { User } from '../../../access/models/user.entity';
import { IProfileService } from './IProfileService';
import { NotFoundError, AppError } from '../../../../errors/AppError';
import { removeEmptyFields } from '../../../../helpers/functions';
import { StorageService } from '../../../../services/storage.service';

// Common IANA timezone list (abbreviated for compactness)
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
export class ProfileService implements IProfileService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private storage: StorageService,
  ) {}

  async index(userId: string): Promise<any> {
    const data = await this.userRepo.findOne({
      where: { id: userId },
      relations: { roles: true },
    });
    if (!data) throw new NotFoundError('User not found');
    return { data, timezones: TIMEZONES };
  }

  async update(
    userId: string,
    request: any,
    files?: Record<string, any[]>,
  ): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Handle file upload — multer memoryStorage (buffer) → StorageService,
    // sehingga jalan di semua STORAGE_DRIVER (local menulis ke basePath yang
    // di-mount statis di /storage, oss/s3 lewat client masing-masing).
    // Pola sama dengan MediaService: key = uuid + ekstensi file asli.
    const picture = files?.picture?.[0];
    if (picture?.buffer) {
      const ext =
        path.extname(picture.originalname || '').toLowerCase() || '.png';
      const key = `uploads/profile/${crypto.randomUUID()}${ext}`;
      await this.storage.uploadFile(key, picture.buffer);
      request.picture = key;
    }

    const clean = removeEmptyFields({ ...request });
    if (clean.password) {
      clean.password = await bcrypt.hash(clean.password, 10);
    } else {
      delete clean.password;
    }
    delete clean.password_confirmation;

    const merged = this.userRepo.merge(user, clean);
    const result = await this.userRepo.save(merged);
    if (!result) throw new AppError('Update Profile failed', 500);
    return result;
  }
}
