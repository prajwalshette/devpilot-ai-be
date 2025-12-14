import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { BadRequestException, HttpException, ValidationException, 
  DatabaseException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  UnprocessableEntityException,
  TooManyRequestsException,
  InternalServerErrorException,
  ServiceUnavailableException} from '@/exceptions';

import { logger } from '@utils/logger';

/**
 * Custom error interface for handling Prisma errors
 */
interface PrismaErrorResponse {
  status: number;
  message: string;
  field?: string;
}

/**
 * Maps Prisma error codes to user-friendly messages
 */
const handlePrismaError = (error: any): PrismaErrorResponse => {
  // Handle Prisma Client Known Request Errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
        return {
          status: 400,
          message: 'The provided value is too long for the field',
          field: error.meta?.target as string,
        };
      
      case 'P2001':
        return {
          status: 404,
          message: 'The record you are looking for does not exist',
        };
      
      case 'P2002':
        const target = error.meta?.target as string[];
        const field = target ? target.join(', ') : 'field';
        return {
          status: 409,
          message: `A record with this ${field} already exists`,
          field,
        };
      
      case 'P2003':
        return {
          status: 400,
          message: 'Invalid reference to related record',
          field: error.meta?.field_name as string,
        };
      
      case 'P2004':
        return {
          status: 400,
          message: 'A constraint failed on the database',
        };
      
      case 'P2005':
        return {
          status: 400,
          message: 'Invalid value provided for the field',
          field: error.meta?.field_name as string,
        };
      
      case 'P2006':
        return {
          status: 400,
          message: 'The provided value is invalid',
          field: error.meta?.field_name as string,
        };
      
      case 'P2007':
        return {
          status: 400,
          message: 'Data validation error',
        };
      
      case 'P2008':
        return {
          status: 400,
          message: 'Failed to parse the query',
        };
      
      case 'P2009':
        return {
          status: 400,
          message: 'Failed to validate the query',
        };
      
      case 'P2010':
        return {
          status: 400,
          message: 'Raw query failed',
        };
      
      case 'P2011':
        return {
          status: 400,
          message: 'A required field is missing',
          field: error.meta?.constraint as string,
        };
      
      case 'P2012':
        return {
          status: 400,
          message: 'A required value is missing',
        };
      
      case 'P2013':
        return {
          status: 400,
          message: 'A required argument is missing',
        };
      
      case 'P2014':
        return {
          status: 400,
          message: 'The change you are trying to make violates a required relation',
        };
      
      case 'P2015':
        return {
          status: 404,
          message: 'A related record could not be found',
        };
      
      case 'P2016':
        return {
          status: 400,
          message: 'Query interpretation error',
        };
      
      case 'P2017':
        return {
          status: 400,
          message: 'The records for relation are not connected',
        };
      
      case 'P2018':
        return {
          status: 400,
          message: 'The required connected records were not found',
        };
      
      case 'P2019':
        return {
          status: 400,
          message: 'Input error',
        };
      
      case 'P2020':
        return {
          status: 400,
          message: 'Value out of range for the type',
        };
      
      case 'P2021':
        return {
          status: 500,
          message: 'The table does not exist in the database',
        };
      
      case 'P2022':
        return {
          status: 500,
          message: 'The column does not exist in the database',
        };
      
      case 'P2023':
        return {
          status: 400,
          message: 'Inconsistent column data',
        };
      
      case 'P2024':
        return {
          status: 408,
          message: 'Request timed out. Please try again',
        };
      
      case 'P2025':
        return {
          status: 404,
          message: 'The record you are trying to update or delete does not exist',
        };
      
      case 'P2026':
        return {
          status: 400,
          message: 'The database query does not support this operation',
        };
      
      case 'P2027':
        return {
          status: 500,
          message: 'Multiple database errors occurred during query execution',
        };
      
      case 'P2028':
        return {
          status: 500,
          message: 'Transaction API error',
        };
      
      case 'P2030':
        return {
          status: 500,
          message: 'Cannot find a fulltext index to use for the search',
        };
      
      case 'P2033':
        return {
          status: 400,
          message: 'A number used in the query is out of range',
        };
      
      case 'P2034':
        return {
          status: 409,
          message: 'Transaction failed due to a write conflict',
        };
      
      default:
        return {
          status: 400,
          message: 'A database error occurred',
        };
    }
  }

  // Handle Prisma Client Validation Errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return {
      status: 400,
      message: 'Invalid data provided. Please check your input',
    };
  }

  // Handle Prisma Client Initialization Error
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      message: 'Database connection failed. Please try again later',
    };
  }

  // Handle Prisma Client Rust Panic Error
  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return {
      status: 500,
      message: 'An unexpected database error occurred',
    };
  }

  // Not a Prisma error
  return {
    status: 500,
    message: error.message || 'Something went wrong',
  };
};

/**
 * Main error middleware with Prisma and custom exception handling
 */
export const ErrorMiddleware = (
  error: HttpException | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    let status: number;
    let message: string;
    let field: string | undefined;

    // 1. Check if it's a Prisma error (highest priority)
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientValidationError ||
      error instanceof Prisma.PrismaClientInitializationError ||
      error instanceof Prisma.PrismaClientRustPanicError ||
      error.constructor.name.includes('Prisma')
    ) {
      const prismaError = handlePrismaError(error);
      status = prismaError.status;
      message = prismaError.message;
      field = prismaError.field;

      // Log the actual Prisma error for debugging
      logger.error(`[PRISMA ERROR] [${req.method}] ${req.path} ${JSON.stringify({
        statusCode: status,
        message,
        field,
        prismaCode: (error as any).code,
        prismaMessage: error.message,
        meta: (error as any).meta,
      })}`);
    } 
    // 2. Handle ValidationException with field details
    else if (error instanceof ValidationException) {
      status = error.status;
      message = error.message;

      logger.error(`[VALIDATION ERROR] [${req.method}] ${req.path} ${JSON.stringify({
        statusCode: status,
        message,
        errors: error.errors,
      })}`);

      // Return validation errors with field details
      const response: any = { message };
      if (error.errors && error.errors.length > 0) {
        response.errors = error.errors;
      }

      if (process.env.NODE_ENV === 'development') {
        response.stack = error.stack;
      }

      return res.status(status).json(response);
    }
    // 3. Handle DatabaseException
    else if (error instanceof DatabaseException) {
      status = error.status;
      message = error.message;
      field = error.field;

      logger.error(`[DATABASE ERROR] [${req.method}] ${req.path} ${JSON.stringify({
        statusCode: status,
        message,
        field,
      })}`);
    }
    // 4. Handle all other custom HTTP exceptions
    else if (
      error instanceof BadRequestException ||
      error instanceof UnauthorizedException ||
      error instanceof ForbiddenException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException ||
      error instanceof UnprocessableEntityException ||
      error instanceof TooManyRequestsException ||
      error instanceof InternalServerErrorException ||
      error instanceof ServiceUnavailableException ||
      error instanceof HttpException
    ) {
      status = error.status || 500;
      message = error.message || 'Something went wrong';

      // Determine error type for logging
      const errorType = error.constructor.name;
      
      logger.error(`[${errorType}] [${req.method}] ${req.path} ${JSON.stringify({
        statusCode: status,
        message,
      })}`);
    }
    // 5. Handle generic/unknown errors
    else {
      status = 500;
      message = process.env.NODE_ENV === 'development' 
        ? error.message || 'An unexpected error occurred'
        : 'An unexpected error occurred';

      logger.error(`[UNHANDLED ERROR] [${req.method}] ${req.path} ${JSON.stringify({
        message: error.message,
        stack: error.stack,
        errorType: error.constructor.name,
      })}`);
    }

    // Build response object
    const response: any = { message };
    
    // Add field if present
    if (field) {
      response.field = field;
    }

    // In development mode, include more details
    if (process.env.NODE_ENV === 'development') {
      response.details = error.message;
      response.stack = error.stack;
      response.errorType = error.constructor.name;
    }

    // Send the response
    res.status(status).json(response);
  } catch (err) {
    // Fallback error handler if something goes wrong in error middleware
    logger.error('Critical error in error middleware: ' + String(err));
    res.status(500).json({ 
      message: 'An unexpected error occurred',
      ...(process.env.NODE_ENV === 'development' && { 
        middlewareError: String(err) 
      })
    });
  }
};