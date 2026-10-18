import type { INestApplication } from '@nestjs/common';
import { json, type Request, type Response, type NextFunction } from 'express';

/** Register before Nest's default parser: generic payloads may exceed its 100 KiB limit. */
export function configureGenericDiscussionBody(app: INestApplication) {
  const parse = json({ limit: '300kb', inflate: false });
  // Nest detects parsers by middleware name. A route-local parser must not suppress its global parser.
  app.use(
    '/api/discussions',
    (req: Request, res: Response, next: NextFunction) => parse(req, res, next)
  );
  app.use(
    '/api/discussions',
    (error: unknown, _req: Request, res: Response, next: NextFunction) => {
      if (!error) return next();
      const status =
        typeof error === 'object' && error !== null && 'status' in error
          ? error.status
          : 400;
      const code = status === 413 || status === 415 ? status : 400;
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res
        .status(code)
        .json({ statusCode: code, message: 'Invalid discussion request body' });
    }
  );
}
