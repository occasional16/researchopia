/**
 * 统一API错误类
 * 用于标准化API错误响应
 */

export class APIError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'APIError';
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    };
  }
}

/**
 * 预定义错误类型
 */
export class NotFoundError extends APIError {
  constructor(message = 'Resource not found', details?: unknown) {
    super(message, 404, 'NOT_FOUND', details);
  }
}

export class UnauthorizedError extends APIError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(message, 401, 'UNAUTHORIZED', details);
  }
}

export class BadRequestError extends APIError {
  constructor(message = 'Bad request', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class InternalServerError extends APIError {
  constructor(message = 'Internal server error', details?: unknown) {
    super(message, 500, 'INTERNAL_SERVER_ERROR', details);
  }
}

/**
 * 错误处理工具函数
 */
export function handleAPIError(error: unknown): APIError {
  if (error instanceof APIError) {
    return error;
  }

  if (error instanceof Error) {
    return new InternalServerError(error.message, { originalError: error.name });
  }

  return new InternalServerError('Unknown error occurred', { error });
}
