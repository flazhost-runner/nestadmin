import { Controller, Post, Get, Req, UseGuards, Body } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from '../../services/auth.service';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../utils/response';
import { routeRegistry } from '../../../../utils/named-routes';

@Controller('api/v1/auth')
@SkipThrottle()
export class AuthApiController {
  constructor(private authService: AuthService) {
    routeRegistry.register('api.v1.auth.login', 'POST', '/api/v1/auth/login');
    routeRegistry.register('api.v1.auth.logout', 'POST', '/api/v1/auth/logout');
    routeRegistry.register('api.v1.auth.me', 'GET', '/api/v1/auth/me');
    routeRegistry.register(
      'api.v1.auth.register',
      'POST',
      '/api/v1/auth/register',
    );
    routeRegistry.register(
      'api.v1.auth.reset.request',
      'POST',
      '/api/v1/auth/reset/request',
    );
    routeRegistry.register(
      'api.v1.auth.reset.process',
      'POST',
      '/api/v1/auth/reset/process',
    );
  }

  @Post('login')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  @UseGuards(AuthGuard('local'))
  async login(@Req() req: Request) {
    const { token, user } = await this.authService.loginApi(req.user);
    void ResponseHandler.success(req.res, 'Login successful', { token, user });
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request) {
    const user = req.user as any;
    await this.authService.logout(user.jti, user.exp);
    void ResponseHandler.success(req.res, 'Logged out successfully');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    void ResponseHandler.success(req.res, 'OK', req.user);
  }

  @Post('register')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  async register(@Body() body: any, @Req() req: Request) {
    const user = await this.authService.register(body);
    void ResponseHandler.success(req.res, 'Registration successful', user, 201);
  }

  @Post('reset/request')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  async resetRequest(@Body() body: any, @Req() req: Request) {
    await this.authService.requestOTP(body.email);
    void ResponseHandler.success(req.res, 'OTP sent to email');
  }

  @Post('reset/process')
  @Throttle({ otpLimiter: { limit: 5, ttl: 900000 } })
  async resetProcess(@Body() body: any, @Req() req: Request) {
    await this.authService.processOTP(body.email, body.otp, body.password);
    void ResponseHandler.success(req.res, 'Password reset successful');
  }
}
