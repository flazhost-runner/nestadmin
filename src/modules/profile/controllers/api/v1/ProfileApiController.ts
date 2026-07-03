import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { ProfileService } from '../../../services/v1/ProfileService';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../../utils/response';
import { routeRegistry } from '../../../../../utils/named-routes';

@Controller('api/v1/profile')
@UseGuards(JwtAuthGuard)
export class ProfileApiController {
  constructor(private profileService: ProfileService) {
    routeRegistry.register('api.v1.profile.index', 'GET', '/api/v1/profile');
  }

  @Get()
  async index(@Req() req: Request) {
    const user = req.user as any;
    const result = await this.profileService.index(user.id);
    const { data } = result;
    void ResponseHandler.success(req.res, 'OK', {
      id: data.id,
      name: data.name,
      email: data.email,
      timezone: data.timezone,
      picture: data.picture,
      status: data.status,
    });
  }
}
