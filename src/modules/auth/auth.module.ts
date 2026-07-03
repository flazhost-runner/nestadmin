import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { User } from '../access/models/user.entity';
import { AuthService } from './services/auth.service';
import { LocalStrategy } from './strategies/local.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuthWebController } from './controllers/web/auth.controller';
import { AuthApiController } from './controllers/api/auth.api.controller';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AccessGuard } from './guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-jwt-secret'),
        signOptions: { expiresIn: config.get('JWT_EXPIRES_IN', '7d') },
      }),
    }),
  ],
  controllers: [AuthWebController, AuthApiController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    SessionAuthGuard,
    JwtAuthGuard,
    AccessGuard,
  ],
  exports: [AuthService, SessionAuthGuard, JwtAuthGuard, AccessGuard],
})
export class AuthModule {}
