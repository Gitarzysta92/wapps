import type { INestApplication } from '@nestjs/common';
import { json, type Request, type Response, type NextFunction } from 'express';

/** Register before Nest's parser so malformed and oversized staff bodies also stay private. */
export function configureHealthMonitorBody(app: INestApplication) {
  const parse = json({ limit: '8kb', inflate: false });
  app.use(
    '/api/editorial/health-monitors',
    (req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      parse(req, res, next);
    }
  );
  app.use(
    '/api/editorial/health-monitors',
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (!error) return next();
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? error.status
          : 400;
      const code = status === 413 || status === 415 ? status : 400;
      res
        .status(code)
        .json({
          statusCode: code,
          message: 'Invalid health monitor request body',
        });
    }
  );
}
