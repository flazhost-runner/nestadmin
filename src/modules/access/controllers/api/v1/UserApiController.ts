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
import { UserService } from '../../../services/v1/UserService';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { ResponseHandler } from '../../../../../utils/response';
import { routeRegistry } from '../../../../../utils/named-routes';

const BASE = 'api/v1/access/users';

@Controller(BASE)
@UseGuards(JwtAuthGuard)
export class UserApiController {
  constructor(private userService: UserService) {
    routeRegistry.register('api.v1.access.user.index', 'GET', `/${BASE}`);
    routeRegistry.register('api.v1.access.user.store', 'POST', `/${BASE}`);
    routeRegistry.register('api.v1.access.user.show', 'GET', `/${BASE}/:id`);
    routeRegistry.register('api.v1.access.user.update', 'PUT', `/${BASE}/:id`);
    routeRegistry.register(
      'api.v1.access.user.delete',
      'DELETE',
      `/${BASE}/:id`,
    );
    routeRegistry.register(
      'api.v1.access.user.delete_selected',
      'POST',
      `/${BASE}/delete_selected`,
    );
  }

  @Get()
  async index(@Req() req: Request) {
    const result = await this.userService.index(req.query as any);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Post()
  async store(@Body() body: any, @Req() req: Request) {
    const selected = body['roles[]'] ?? body.roles ?? [];
    const result = await this.userService.store({
      ...body,
      roles: Array.isArray(selected) ? selected : [selected],
    });
    void ResponseHandler.success(req.res, 'User created', result, 201);
  }

  @Get(':id')
  async show(@Param('id') id: string, @Req() req: Request) {
    const result = await this.userService.edit(id);
    void ResponseHandler.success(req.res, 'OK', result);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() body: any,
    @Req() req: Request,
  ) {
    const selected = body['roles[]'] ?? body.roles ?? [];
    const result = await this.userService.update(id, {
      ...body,
      roles: Array.isArray(selected) ? selected : [selected],
    });
    void ResponseHandler.success(req.res, 'User updated', result);
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: Request) {
    await this.userService.delete(id);
    void ResponseHandler.success(req.res, 'User deleted');
  }

  @Post('delete_selected')
  async deleteSelected(@Body() body: any, @Req() req: Request) {
    const raw = body['selected[]'] ?? body.ids ?? [];
    const ids: string[] = Array.isArray(raw) ? raw : [raw];
    await this.userService.deleteSelected(ids);
    void ResponseHandler.success(req.res, 'Users deleted');
  }
}
