// ARCHIVO: backend/finance-service/src/utils/apiError.js
class ApiError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
  }
}

module.exports = { ApiError };
