import { Controller, Get, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { FeTemplateService } from '../services/fe-template.service';
import { routeRegistry } from '../../../utils/named-routes';

@Controller()
export class HomeController {
  constructor(
    private feTemplateService: FeTemplateService,
    private configService: ConfigService,
  ) {
    routeRegistry.register('web.home.root', 'GET', '/');
    routeRegistry.register('web.home.index', 'GET', '/home');
  }

  private async renderLanding(req: Request, res: Response): Promise<void> {
    const slug = await this.feTemplateService.getActiveSlug();

    // Default EJS template → render as EJS view with fe layout.
    if (this.feTemplateService.isDefaultEjs(slug)) {
      return res.render('home/views/fe/default/index', {
        layout: 'layouts/fe/default/main',
        title:
          res.locals.setting?.name ||
          this.configService.get<string>('APP_NAME', 'NestAdmin'),
        setting: res.locals.setting,
      });
    }

    // Non-default → serve raw HTML from local cache (ensure first).
    try {
      await this.feTemplateService.ensure(slug);
    } catch {
      // If ensure fails, fall back gracefully to EJS default.
    }

    const html = await this.feTemplateService.getActiveHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get('/')
  async root(@Req() req: Request, @Res() res: Response) {
    return this.renderLanding(req, res);
  }

  @Get('/home')
  async index(@Req() req: Request, @Res() res: Response) {
    return this.renderLanding(req, res);
  }
}
