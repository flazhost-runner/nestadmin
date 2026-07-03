import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SettingService } from '../../../services/v1/SettingService';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../../utils/response';
import { routeRegistry } from '../../../../../utils/named-routes';

@Controller('api/v1/setting')
@UseGuards(JwtAuthGuard)
export class SettingApiController {
  constructor(private settingService: SettingService) {
    routeRegistry.register('api.v1.setting.index', 'GET', '/api/v1/setting');
  }

  @Get()
  async index(@Req() req: Request) {
    const result = await this.settingService.index();
    const s = result.data;
    void ResponseHandler.success(req.res, 'OK', {
      id: s.id,
      name: s.name,
      theme: s.theme,
      fe_template: s.fe_template,
    });
  }
}
