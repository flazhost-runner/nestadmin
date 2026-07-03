import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../access/models/user.entity';
import {
  UnauthorizedError,
  NotFoundError,
  AppError,
} from '../../../errors/AppError';
import { generateOTP, hashOTP, verifyOTP } from '../../../helpers/otp';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private tokenBlacklist = new Map<string, number>(); // jti → expiry epoch; in-memory fallback

  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: { roles: { permissions: true } },
    });
    if (!user) throw new UnauthorizedError('Invalid email or password');
    if (user.blocked) throw new UnauthorizedError('Account is blocked');
    if (user.status !== 'Active')
      throw new UnauthorizedError('Account is inactive');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedError('Invalid email or password');

    // Build session-safe user object
    const permissions = user.roles.flatMap((r) => r.permissions || []);
    return {
      id: user.id,
      code: user.code,
      name: user.name,
      email: user.email,
      status: user.status,
      picture: user.picture,
      timezone: user.timezone,
      roles: user.roles.map((r) => ({ id: r.id, name: r.name })),
      permissions: permissions.map((p) => ({ name: p.name, method: p.method })),
    };
  }

  async loginApi(user: any): Promise<{ token: string; user: any }> {
    const jti = uuidv4();
    const expiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
    const token = this.jwtService.sign(
      { sub: user.id, email: user.email, roles: user.roles, jti },
      { expiresIn: expiresIn as any },
    );
    return { token, user };
  }

  async logout(jti: string, exp: number): Promise<void> {
    // Store in blacklist until token expires
    this.tokenBlacklist.set(jti, exp);
    // Clean up expired entries
    const now = Date.now() / 1000;
    for (const [key, expiry] of this.tokenBlacklist.entries()) {
      if (expiry < now) this.tokenBlacklist.delete(key);
    }
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    if (!this.tokenBlacklist.has(jti)) return false;
    const exp = this.tokenBlacklist.get(jti);
    if (exp < Date.now() / 1000) {
      this.tokenBlacklist.delete(jti);
      return false;
    }
    return true;
  }

  async requestOTP(email: string): Promise<string> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user) throw new NotFoundError('User not found');
    const otp = generateOTP();
    const hash = await hashOTP(otp);
    const expiryMinutes = this.configService.get<number>(
      'OTP_EXPIRY_MINUTES',
      10,
    );
    const expires = Date.now() + expiryMinutes * 60 * 1000;
    await this.userRepo.update(user.id, {
      password_otp: hash,
      password_otp_expires: String(expires),
    });
    return otp; // caller sends via email
  }

  async processOTP(
    email: string,
    otp: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userRepo.findOne({ where: { email } });
    if (!user || !user.password_otp || !user.password_otp_expires) {
      throw new AppError('Invalid OTP request', 400);
    }
    if (Date.now() > parseInt(user.password_otp_expires)) {
      throw new AppError('OTP expired', 400);
    }
    const valid = await verifyOTP(otp, user.password_otp);
    if (!valid) throw new AppError('Invalid OTP', 400);

    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
    const hashed = await bcrypt.hash(newPassword, rounds);
    await this.userRepo.update(user.id, {
      password: hashed,
      password_otp: null,
      password_otp_expires: null,
    });
  }

  async register(data: {
    name: string;
    email: string;
    password: string;
  }): Promise<User> {
    const exists = await this.userRepo.findOne({
      where: { email: data.email },
    });
    if (exists) throw new AppError('Email already registered', 409);
    const rounds = this.configService.get<number>('BCRYPT_ROUNDS', 10);
    const hashed = await bcrypt.hash(data.password, rounds);
    const code = 'USR' + Date.now().toString().slice(-8);
    const user = this.userRepo.create({
      id: uuidv4(),
      code,
      name: data.name,
      email: data.email,
      password: hashed,
      status: 'Active',
      timezone: 'UTC',
    });
    return this.userRepo.save(user);
  }
}
