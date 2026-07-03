import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import { Request, Response } from 'express';
import { DashboardService } from '../../../services/DashboardService';
import { SessionAuthGuard } from '../../../../auth/guards/session-auth.guard';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = '/admin/v1/dashboard';

@Controller()
@UseGuards(SessionAuthGuard)
export class DashboardWebController {
  constructor(private dashboardService: DashboardService) {
    routeRegistry.register('admin.v1.dashboard.index', 'GET', BASE);
  }

  @Get(BASE)
  async index(@Req() req: Request, @Res() res: Response) {
    const stats = await this.dashboardService.getStats();
    res.render('dashboard/views/be/default/index', {
      title: 'Dashboard',
      stats,
    });
  }
}
