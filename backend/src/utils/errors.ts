export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super('VALIDATION_ERROR', message, 400, details);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404);
    this.name = 'NotFoundError';
  }
}

export class BusinessError extends AppError {
  constructor(message: string, details?: any) {
    super('BUSINESS_ERROR', message, 400, details);
    this.name = 'BusinessError';
  }
}

export class FileParseError extends AppError {
  constructor(message: string, details?: any) {
    super('FILE_PARSE_ERROR', message, 400, details);
    this.name = 'FileParseError';
  }
}
