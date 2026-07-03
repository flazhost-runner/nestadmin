import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/components';

@Controller()
@UseGuards(SessionAuthGuard)
export class ComponentsWebController {
  constructor() {
    routeRegistry.register('admin.v1.components.index', 'GET', BASE);
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    res.render('components/views/be/default/index', {
      title: 'UI Components',
    });
  }
}
