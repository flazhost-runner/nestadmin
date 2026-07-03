import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Req,
  Body,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { PermissionService } from '../../../services/v1/PermissionService';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../../utils/response';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = 'api/v1/access/permissions';

@Controller(BASE)
@UseGuards(JwtAuthGuard)
export class PermissionApiController {
  constructor(private permissionService: PermissionService) {
    routeRegistry.register('api.v1.access.permission.index', 'GET', `/${BASE}`);
    routeRegistry.register(
      'api.v1.access.permission.store',
      'POST',
      `/${BASE}`,
    );
    routeRegistry.register(
      'api.v1.access.permission.show',
      'GET',
      `/${BASE}/:id`,
    );
    routeRegistry.register(
      'api.v1.access.permission.update',
      'PUT',
      `/${BASE}/:id`,
    );
    routeRegistry.register(
      'api.v1.access.permission.delete',
      'DELETE',
      `/${BASE}/:id`,
    );
    routeRegistry.register(
      'api.v1.access.permission.delete_selected',
      'POST',
      `/${BASE}/delete_selected`,
    );
    routeRegistry.register(
      'api.v1.access.permission.sync',
      'POST',
      `/${BASE}/sync`,
    );
  }

  @Get()
  async index(@Req() req: Request) {
    const result = await this.permissionService.index(req.query as any);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Post()
  async store(@Body() body: any, @Req() req: Request) {
    const result = await this.permissionService.store(body);
    void ResponseHandler.success(req.res, 'Permission created', result, 201);
  }

  @Get(':id')
  async show(@Param('id') id: string, @Req() req: Request) {
    const result = await this.permissionService.edit(id);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const result = await this.permissionService.update(id, body);
    void ResponseHandler.success(req.res, 'Permission updated', result);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.permissionService.delete(id);
    void ResponseHandler.success(req.res, 'Permission deleted');
  }

  @Post('delete_selected')
  async deleteSelected(@Body() body: any, @Req() req: Request) {
    const raw = body['selected[]'] ?? body.ids ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.permissionService.deleteSelected(ids);
    void ResponseHandler.success(req.res, 'Permissions deleted');
  }

  @Post('sync')
  async sync(@Req() req: Request) {
    await this.permissionService.syncFromRoutes();
    void ResponseHandler.success(req.res, 'Permissions synced from routes');
  }
}
