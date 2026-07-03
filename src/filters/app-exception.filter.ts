import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppError, ValidationError } from '../errors/AppError';

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // Guard: don't attempt double-send
    if (res.headersSent) return;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'An error occurred';
    let fields: Record<string, string> | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      message =
        exception instanceof AppError
          ? exception.message
          : String(exception.message);
      if (exception instanceof ValidationError) fields = exception.fields;
    } else {
      this.logger.error(exception);
    }

    const isApi = req.path.startsWith('/api/');
    const isProd = process.env.NODE_ENV === 'production';

    try {
      if (isApi) {
        res.status(status).json({
          success: false,
          message: isProd && status >= 500 ? 'Internal server error' : message,
          ...(fields ? { errors: fields } : {}),
        });
        return;
      }

      // Web: flash + redirect
      if (status === 401) {
        res.redirect('/auth/login');
        return;
      }
      if (status === 403) {
        req.flash?.('error', message);
        res.redirect(req.get('Referrer') || '/admin/v1/dashboard');
        return;
      }
      if (fields && req.session) {
        (req.session as any).errors = fields;
        (req.session as any).old = req.body;
      }
      req.flash?.(
        'error',
        isProd && status >= 500 ? 'An error occurred' : message,
      );
      res.redirect(req.get('Referrer') || '/admin/v1/dashboard');
    } catch (sendErr) {
      this.logger.error('Exception filter failed to send response', sendErr);
    }
  }
}
