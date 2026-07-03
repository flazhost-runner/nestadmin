import { Controller, Get, Put, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { ProfileService } from '../../../services/v1/ProfileService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/profile';

@Controller()
@UseGuards(SessionAuthGuard)
export class ProfileWebController {
  constructor(private profileService: ProfileService) {
    routeRegistry.register('admin.v1.profile.index', 'GET', BASE);
    routeRegistry.register('admin.v1.profile.update', 'PUT', BASE);
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const userId = (req.session as any)?.user?.id;
    const result = await this.profileService.index(userId);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('profile/views/be/default/profile', {
      title: 'Profile',
      ...result,
    });
  }

  @Put(BASE)
  async update(@Req() req: Request, @Res() res: Response) {
    const userId = (req.session as any)?.user?.id;
    const files = (req as any).files || {};
    const updated = await this.profileService.update(userId, req.body, files);
    // Refresh session user
    (req.session as any).user = {
      ...(req.session as any).user,
      name: updated.name,
      email: updated.email,
      picture: updated.picture,
      timezone: updated.timezone,
    };
    (req as any).flash?.('success', 'Update Profile Success.');
    req.session.save(() => res.redirect(BASE));
  }
}
