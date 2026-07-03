import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  Body,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { AuthService } from '../../services/auth.service';
import { routeRegistry } from '../../../../utils/named-routes';

@Controller()
@SkipThrottle()
export class AuthWebController {
  constructor(private authService: AuthService) {
    // Register named routes
    routeRegistry.register('web.auth.login', 'GET', '/auth/login');
    routeRegistry.register('web.auth.login.post', 'POST', '/auth/login');
    routeRegistry.register('web.auth.register', 'GET', '/auth/register');
    routeRegistry.register('web.auth.register.post', 'POST', '/auth/register');
    routeRegistry.register('web.auth.logout', 'POST', '/auth/logout');
    routeRegistry.register(
      'admin.v1.auth.reset.req',
      'GET',
      '/admin/v1/auth/reset/req',
    );
    routeRegistry.register(
      'admin.v1.auth.reset.request',
      'POST',
      '/admin/v1/auth/reset/request',
    );
    routeRegistry.register(
      'admin.v1.auth.reset.proc',
      'GET',
      '/admin/v1/auth/reset/proc',
    );
    routeRegistry.register(
      'admin.v1.auth.reset.process',
      'POST',
      '/admin/v1/auth/reset/process',
    );
  }

  @Get('/auth/login')
  loginPage(@Req() req: Request, @Res() res: Response) {
    if ((req.session as any)?.user) return res.redirect('/admin/v1/dashboard');
    res.render('auth/views/be/default/login', {
      layout: 'layouts/be/default/full-width',
      title: 'Login',
      errors: (req.session as any)?.errors || [],
      flash: (req as any).flash?.(),
    });
  }

  @Post('/auth/login')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  @UseGuards(AuthGuard('local'))
  async loginPost(@Req() req: Request, @Res() res: Response) {
    (req.session as any)['user'] = req.user as any;
    req.session.save(() => res.redirect('/admin/v1/dashboard'));
  }

  @Get('/auth/register')
  registerPage(@Req() req: Request, @Res() res: Response) {
    res.render('auth/views/be/default/register', {
      layout: 'layouts/be/default/full-width',
      title: 'Register',
      flash: (req as any).flash?.(),
    });
  }

  @Post('/auth/register')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  async registerPost(@Req() req: Request, @Res() res: Response) {
    await this.authService.register(req.body);
    (req as any).flash?.('success', 'Register Success.');
    res.redirect('/auth/login');
  }

  @Post('/auth/logout')
  async logout(@Req() req: Request, @Res() res: Response) {
    req.session?.destroy?.(() => {});
    res.redirect('/auth/login');
  }

  @Get('/admin/v1/auth/reset/req')
  resetReqPage(@Req() req: Request, @Res() res: Response) {
    res.render('auth/views/be/default/reset_req', {
      layout: 'layouts/be/default/full-width',
      title: 'Reset Password',
      flash: (req as any).flash?.(),
    });
  }

  @Post('/admin/v1/auth/reset/request')
  @Throttle({ authLimiter: { limit: 10, ttl: 900000 } })
  async resetRequest(@Req() req: Request, @Res() res: Response) {
    const { email } = req.body;
    const otp = await this.authService.requestOTP(email);
    // In production: send OTP via email
    void otp; // sent via email in production
    (req as any).flash?.('success', 'OTP Send Success.');
    res.redirect(
      `/admin/v1/auth/reset/proc?email=${encodeURIComponent(email)}`,
    );
  }

  @Get('/admin/v1/auth/reset/proc')
  resetProcPage(@Req() req: Request, @Res() res: Response) {
    res.render('auth/views/be/default/reset_proc', {
      layout: 'layouts/be/default/full-width',
      title: 'Enter OTP',
      email: req.query.email,
      flash: (req as any).flash?.(),
    });
  }

  @Post('/admin/v1/auth/reset/process')
  @Throttle({ otpLimiter: { limit: 5, ttl: 900000 } })
  async resetProcess(@Req() req: Request, @Res() res: Response) {
    const { email, otp, password } = req.body;
    await this.authService.processOTP(email, otp, password);
    (req as any).flash?.('success', 'Reset Password Success.');
    res.redirect('/auth/login');
  }
}
