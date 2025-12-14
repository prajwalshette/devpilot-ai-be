import { Prisma } from '@prisma/client';
import { HttpException } from './HttpException';
import { logger } from '@/utils/logger';

export function formatPrismaError(error: unknown): HttpException {
  logger.error(error);

  const withDetails = (status: number, message: string, err: any, extra?: unknown) =>
    new HttpException(status, message, err?.code, extra ?? err?.meta ?? undefined);

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2000':
        return withDetails(400, 'The provided value is too long for the column.', error);
      case 'P2001': {
        const meta = (error as any)?.meta as { modelName?: string; cause?: string } | undefined;
        const model = meta?.modelName ? ` for ${meta.modelName}` : '';
        return withDetails(404, `Record not found${model}.`, error, meta);
      }
      case 'P2002': {
        const meta = (error as any)?.meta as { target?: string[] | string } | undefined;
        const target = Array.isArray(meta?.target) ? meta?.target.join(', ') : meta?.target;
        const msg = target
          ? `Duplicate value: unique constraint would be violated on [${target}].`
          : 'Duplicate value: a unique constraint would be violated.';
        return withDetails(409, msg, error, meta);
      }
      case 'P2003':
        {
          // Improve FK error messaging with human-readable field names
          const meta = (error as any)?.meta as { field_name?: string } | undefined;
          const rawFieldName = meta?.field_name;

          if (!rawFieldName) {
            return withDetails(409, 'Foreign key constraint failed. Referenced record does not exist.', error, meta);
          }

          // Example: "Lead_brand_id_fkey (index)" → "Lead_brand_id_fkey"
          const normalized = rawFieldName.replace(/ \(index\)$/i, '');

          // Known mappings for clearer messages
          if (/Lead_brand_id_fkey/i.test(normalized)) {
            return withDetails(409, 'Invalid brand_id: referenced brand does not exist.', error, meta);
          }
          if (/Lead_campaign_id_fkey/i.test(normalized)) {
            return withDetails(409, 'Invalid campaign_id: referenced campaign does not exist.', error, meta);
          }
          if (/Lead_selected_dealer_id_fkey/i.test(normalized) || /Lead_dealer_id_fkey/i.test(normalized)) {
            return withDetails(409, 'Invalid dealer_id: referenced dealer does not exist.', error, meta);
          }

          // Generic extractor: <Table>_<field>_fkey → use <field>
          const match = normalized.match(/^[A-Za-z0-9]+_([A-Za-z0-9_]+)_fkey$/i);
          const refField = match?.[1];
          if (refField) {
            return withDetails(409, `Invalid ${refField}: referenced record does not exist.`, error, { ...meta, refField });
          }

          return withDetails(409, 'Foreign key constraint failed. Referenced record does not exist.', error, meta);
        }
      case 'P2004':
        return withDetails(400, 'A constraint failed on the database.', error);
      case 'P2005': {
        const meta = (error as any)?.meta as { field_name?: string } | undefined;
        const field = meta?.field_name ? ` for field ${meta.field_name}` : '';
        return withDetails(400, `Invalid value stored${field}.`, error, meta);
      }
      case 'P2006':
        return withDetails(400, 'The requested field does not exist in the database.', error);
      case 'P2007':
        return withDetails(400, 'Data validation error.', error);
      case 'P2008':
        return withDetails(500, 'Failed to parse the query.', error);
      case 'P2009':
        return withDetails(500, 'Query validation failed.', error);
      case 'P2010':
        return withDetails(500, 'Raw query failed.', error);
      case 'P2011':
        return withDetails(400, 'Null constraint violation.', error);
      case 'P2012':
        return withDetails(400, 'Missing required field.', error);
      case 'P2013':
        return withDetails(400, 'Missing required argument.', error);
      case 'P2014':
        return withDetails(409, 'Relation violation: the change would violate a relation.', error);
      case 'P2015':
        return withDetails(404, 'Record not found.', error);
      case 'P2016':
        return withDetails(400, 'Query interpretation error.', error);
      case 'P2017':
        return withDetails(400, 'Multiple records found when only one was expected.', error);
      case 'P2018':
        return withDetails(400, 'Path does not exist.', error);
      case 'P2019':
        return withDetails(400, 'Input error: input value is invalid.', error);
      case 'P2020':
        return withDetails(400, 'Value out of range for the type.', error);
      case 'P2021':
        return withDetails(400, 'Table does not exist in the database.', error);
      case 'P2022':
        return withDetails(400, 'Column does not exist in the table.', error);
      case 'P2023':
        return withDetails(400, 'Inconsistent database state.', error);
      case 'P2024':
        return withDetails(503, 'Database is temporarily unavailable.', error);
      case 'P2025': {
        const meta = (error as any)?.meta as { cause?: string } | undefined;
        const msg = meta?.cause ? meta.cause : 'Record not found for update/delete.';
        return withDetails(404, msg, error, meta);
      }
      case 'P2026':
        return withDetails(500, 'Operation failed due to server error.', error);
      case 'P2027':
        return withDetails(500, 'Transaction could not be completed.', error);
      case 'P2028':
        return withDetails(500, 'Timeout occurred during database operation.', error);
      default:
        return withDetails(500, `Prisma error: ${error.message}`, error);
    }
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return new HttpException(500, `Unknown database error occurred: ${error.message}`);
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    return new HttpException(500, 'The database engine panicked. Please report this error.');
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return new HttpException(500, 'Failed to initialize Prisma client.');
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return new HttpException(400, 'Validation error: check input values.');
  }

  return new HttpException(500, 'Unexpected error occurred.');
}
