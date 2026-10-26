import type { Request, Response, NextFunction, RequestHandler } from "express";
export const asyncRoute =
  (
    handler: (req: Request, res: Response, next: NextFunction) => unknown,
  ): RequestHandler =>
  (req, res, next) => {
    Promise.resolve()
      .then(() => handler(req, res, next))
      .catch(next);
  };
