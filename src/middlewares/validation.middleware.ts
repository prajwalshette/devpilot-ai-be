import { NextFunction, Request, Response } from 'express';
import { ZodError, ZodType } from 'zod';
import { HttpException } from '@exceptions/HttpException';

/**
 * @name ValidationMiddleware
 * @description Validates request data using Zod schemas
 * @param schema Zod schema object
 * @param source Source of data to validate: 'body' | 'query' | 'params'
 */
export const ZodValidationMiddleware = (schema: ZodType, source: 'body' | 'query' | 'params' = 'body') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = await schema.parseAsync(req[source]);
      req[source] = validated as any;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        next(new HttpException(400, message));
      } else {
        next(new HttpException(400, 'Validation failed'));
      }
    }
  };
};

/**
 * @name ValidateRequest
 * @description Validates multiple parts of the request (body, query, params)
 * @param schemas Object containing schemas for different parts of the request
 */
export const ZodValidateRequest = (schemas: { body?: ZodType; query?: ZodType; params?: ZodType }) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.issues.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
        next(new HttpException(400, message));
      } else {
        next(new HttpException(400, 'Validation failed'));
      }
    }
  };
};
