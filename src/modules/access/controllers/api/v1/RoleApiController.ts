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
import { RoleService } from '../../../services/v1/RoleService';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../../utils/response';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = 'api/v1/access/roles';

@Controller(BASE)
@UseGuards(JwtAuthGuard)
export class RoleApiController {
  constructor(private roleService: RoleService) {
    routeRegistry.register('api.v1.access.role.index', 'GET', `/${BASE}`);
    routeRegistry.register('api.v1.access.role.store', 'POST', `/${BASE}`);
    routeRegistry.register('api.v1.access.role.show', 'GET', `/${BASE}/:id`);
    routeRegistry.register('api.v1.access.role.update', 'PUT', `/${BASE}/:id`);
    routeRegistry.register(
      'api.v1.access.role.delete',
      'DELETE',
      `/${BASE}/:id`,
    );
    routeRegistry.register(
      'api.v1.access.role.delete_selected',
      'POST',
      `/${BASE}/delete_selected`,
    );
    routeRegistry.register(
      'api.v1.access.role.permission',
      'GET',
      `/${BASE}/:id/permission`,
    );
    routeRegistry.register(
      'api.v1.access.role.permission.assign',
      'POST',
      `/${BASE}/:id/permission/:permission_id/assign`,
    );
    routeRegistry.register(
      'api.v1.access.role.permission.unassign',
      'DELETE',
      `/${BASE}/:id/permission/:permission_id/unassign`,
    );
    routeRegistry.register(
      'api.v1.access.role.permission.assign_selected',
      'POST',
      `/${BASE}/:id/permission/assign_selected`,
    );
    routeRegistry.register(
      'api.v1.access.role.permission.unassign_selected',
      'POST',
      `/${BASE}/:id/permission/unassign_selected`,
    );
  }

  @Get()
  async index(@Req() req: Request) {
    const result = await this.roleService.index(req.query as any);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Post()
  async store(@Body() body: any, @Req() req: Request) {
    const result = await this.roleService.store(body);
    void ResponseHandler.success(req.res, 'Role created', result, 201);
  }

  @Get(':id')
  async show(@Param('id') id: string, @Req() req: Request) {
    const result = await this.roleService.edit(id);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const result = await this.roleService.update(id, body);
    void ResponseHandler.success(req.res, 'Role updated', result);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.roleService.delete(id);
    void ResponseHandler.success(req.res, 'Role deleted');
  }

  @Post('delete_selected')
  async deleteSelected(@Body() body: any, @Req() req: Request) {
    const raw = body['selected[]'] ?? body.ids ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.roleService.deleteSelected(ids);
    void ResponseHandler.success(req.res, 'Roles deleted');
  }

  @Get(':id/permission')
  async permission(@Param('id') id: string, @Req() req: Request) {
    const result = await this.roleService.permission(id, req.query as any);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Post(':id/permission/:permission_id/assign')
  async permissionAssign(
    @Param('id') id: string,
    @Param('permission_id') permission_id: string,
    @Req() req: Request,
  ) {
    const result = await this.roleService.permissionAssign(id, permission_id);
    void ResponseHandler.success(req.res, 'Permission assigned', result);
  }

  @Delete(':id/permission/:permission_id/unassign')
  async permissionUnassign(
    @Param('id') id: string,
    @Param('permission_id') permission_id: string,
    @Req() req: Request,
  ) {
    await this.roleService.permissionUnassign(id, permission_id);
    void ResponseHandler.success(req.res, 'Permission unassigned');
  }

  @Post(':id/permission/assign_selected')
  async permissionAssignSelected(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const raw = body['selected[]'] ?? body.ids ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.roleService.permissionAssignSelected(id, ids);
    void ResponseHandler.success(req.res, 'Permissions assigned');
  }

  @Post(':id/permission/unassign_selected')
  async permissionUnassignSelected(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const raw = body['selected[]'] ?? body.ids ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.roleService.permissionUnassignSelected(id, ids);
    void ResponseHandler.success(req.res, 'Permissions unassigned');
  }
}
