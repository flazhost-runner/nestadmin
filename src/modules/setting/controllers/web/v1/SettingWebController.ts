import {
  Controller,
  Get,
  Put,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SettingService } from '../../../services/v1/SettingService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/setting';

@Controller()
@UseGuards(SessionAuthGuard)
export class SettingWebController {
  constructor(private settingService: SettingService) {
    routeRegistry.register('admin.v1.setting.index', 'GET', BASE);
    routeRegistry.register('admin.v1.setting.update', 'PUT', BASE);
    routeRegistry.register(
      'admin.v1.setting.fe_preview',
      'GET',
      `${BASE}/fe-preview`,
    );
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const filter = req.query as Record<string, any>;
    const result = await this.settingService.index(filter);
    delete (req.session as any).errors;
    delete (req.session as any).old;
    res.render('setting/views/be/default/index', {
      title: 'Setting Management',
      ...result,
    });
  }

  @Put(BASE)
  async update(@Req() req: Request, @Res() res: Response) {
    const files = (req as any).files || {};
    await this.settingService.update(req.body, files);
    (req as any).flash?.('success', 'Save Setting Success.');
    req.session.save(() => res.redirect(BASE));
  }

  @Get(`${BASE}/fe-preview`)
  async fePreview(@Query('slug') slug: string, @Res() res: Response) {
    const html = await this.settingService.fePreview(slug);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }
}
