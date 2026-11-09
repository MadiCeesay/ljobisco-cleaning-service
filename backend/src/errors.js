export class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
export function assert(condition, status = 409, code = 'CONFLICT', message = 'This record changed or this operation is unavailable.') {
  if (!condition) throw new HttpError(status, code, message);
}
export function errorHandler(error, request, response, _next) {
  const validation = error.name === 'ZodError' || error.name === 'ValidationError' || error.name === 'CastError';
  const status = validation ? 422 : error.code === 11000 ? 409 : error.status || (error.type === 'entity.too.large' ? 413 : 500);
  response.status(status).json({ error: { code: validation ? 'VALIDATION_ERROR' : status === 500 ? 'INTERNAL_ERROR' : typeof error.code === 'string' ? error.code : 'REQUEST_FAILED', message: validation ? 'Review the submitted fields.' : error.code === 11000 ? 'This record already exists or changed.' : error instanceof HttpError ? error.message : 'The operation could not be completed.', requestId: request.id } });
}
