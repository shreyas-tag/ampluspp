const { StatusCodes } = require('http-status-codes');

const notFoundHandler = (_req, _res, next) => {
  const err = new Error('Route not found');
  err.statusCode = StatusCodes.NOT_FOUND;
  next(err);
};

const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || StatusCodes.INTERNAL_SERVER_ERROR;
  res.status(statusCode).json({
    message: err.message || 'Something went wrong',
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack
  });
};

module.exports = { notFoundHandler, errorHandler };
