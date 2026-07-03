import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'dev-jwt-secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: any, payload: any) {
    // Check token blacklist
    const isBlacklisted = await this.authService.isTokenBlacklisted(
      payload.jti || payload.sub,
    );
    if (isBlacklisted)
      throw new UnauthorizedException('Token has been revoked');
    return {
      id: payload.sub,
      email: payload.email,
      jti: payload.jti,
      roles: payload.roles,
    };
  }
}
