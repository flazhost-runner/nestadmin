import { Response } from 'express';

export class ResponseHandler {
  static success(res: Response, message: string, data?: any, status = 200) {
    return res.status(status).json({ status: true, message, data });
  }
  static error(res: Response, message: string, status = 500, errors?: any) {
    return res.status(status).json({ status: false, message, errors });
  }
}
