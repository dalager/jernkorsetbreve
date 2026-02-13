# ADR-001: API Error Handling Implementation

## Status

**Accepted**

Date: 2026-02-12

## Context

The Jernkorset project's FastAPI backend currently has minimal error handling with several deficiencies:

### Current State

1. **No Input Validation**: The API accepts letter IDs without validation. Invalid IDs (negative numbers, out-of-range values) cause unhandled exceptions.

2. **Generic Error Responses**: When errors occur, clients receive generic Python exceptions or stack traces rather than structured API responses.

3. **No Pydantic Models**: Request and response data lack formal schema definitions, making the API contract implicit and undocumented.

4. **Direct Array Indexing**: The `get_letter()` function uses direct list indexing (`letters[letter_id - 1]`) which raises `IndexError` for invalid IDs.

5. **No Structured Logging**: Errors are logged via basic `print()` statements without context, correlation IDs, or severity levels.

### Example of Current Problematic Code

```python
@app.get("/letters/{letter_id}")
async def read_letter(letter_id: int):
    return letters[letter_id - 1]  # Raises IndexError for invalid IDs
```

### Business Impact

- Poor developer experience when integrating with the API
- Difficult debugging in production environments
- Inconsistent error responses make client-side error handling unreliable
- No audit trail for failed requests

## Decision

Implement comprehensive error handling following Domain-Driven Design principles with the following components:

### 1. Pydantic Models for Request/Response Validation

Define explicit schemas for all API data structures:

```python
# models.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

class LetterSummary(BaseModel):
    id: int = Field(..., description="Unique letter identifier")
    date: datetime = Field(..., description="Date the letter was written")
    place: Optional[str] = Field(None, description="Location where letter was written")
    sender: str = Field(..., description="Name of the letter sender")
    recipient: str = Field(..., description="Name of the letter recipient")

class LetterDetail(LetterSummary):
    text: str = Field(..., description="Full text content of the letter")

class Place(BaseModel):
    id: str = Field(..., description="Unique place identifier")
    name: str = Field(..., description="Place name")
    geometry: Optional[str] = Field(None, description="GeoJSON geometry")

class ErrorResponse(BaseModel):
    error_code: str = Field(..., description="Machine-readable error code")
    message: str = Field(..., description="Human-readable error message")
    detail: Optional[str] = Field(None, description="Additional error context")
    request_id: Optional[str] = Field(None, description="Request correlation ID")

class ProofreadResponse(BaseModel):
    text: str = Field(..., description="Modernized letter text")
    tps: float = Field(..., description="Tokens per second processing rate")
```

### 2. Proper HTTP Status Codes

Implement consistent HTTP status code usage:

| Status Code | Usage |
|-------------|-------|
| 200 OK | Successful GET/POST requests |
| 400 Bad Request | Malformed request, invalid parameters |
| 404 Not Found | Letter or resource not found |
| 422 Unprocessable Entity | Validation errors (Pydantic) |
| 500 Internal Server Error | Unexpected server errors |
| 503 Service Unavailable | External service failures (e.g., modernizer API) |

### 3. Structured Error Responses

All error responses follow a consistent schema:

```json
{
    "error_code": "LETTER_NOT_FOUND",
    "message": "The requested letter does not exist",
    "detail": "Letter with ID 999 was not found in the collection",
    "request_id": "req_abc123"
}
```

Error codes follow a naming convention:
- `LETTER_NOT_FOUND` - Resource not found errors
- `INVALID_LETTER_ID` - Validation errors
- `MODERNIZER_UNAVAILABLE` - External service errors
- `INTERNAL_ERROR` - Unexpected server errors

### 4. Custom Exception Classes

```python
# exceptions.py
from fastapi import HTTPException

class JernkorsetException(Exception):
    """Base exception for Jernkorset API"""
    def __init__(self, error_code: str, message: str, detail: str = None):
        self.error_code = error_code
        self.message = message
        self.detail = detail
        super().__init__(message)

class LetterNotFoundError(JernkorsetException):
    def __init__(self, letter_id: int):
        super().__init__(
            error_code="LETTER_NOT_FOUND",
            message="The requested letter does not exist",
            detail=f"Letter with ID {letter_id} was not found in the collection"
        )

class InvalidLetterIdError(JernkorsetException):
    def __init__(self, letter_id: int, reason: str):
        super().__init__(
            error_code="INVALID_LETTER_ID",
            message="The provided letter ID is invalid",
            detail=f"Letter ID {letter_id}: {reason}"
        )

class ModernizerServiceError(JernkorsetException):
    def __init__(self, detail: str = None):
        super().__init__(
            error_code="MODERNIZER_UNAVAILABLE",
            message="The text modernization service is unavailable",
            detail=detail
        )
```

### 5. Structured Logging with Context

```python
# config.py
import logging
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar('request_id', default='')

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - [%(request_id)s] - %(message)s'
    )

class RequestContextFilter(logging.Filter):
    def filter(self, record):
        record.request_id = request_id_var.get('')
        return True
```

### 6. Exception Handlers

```python
# main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

@app.exception_handler(JernkorsetException)
async def jernkorset_exception_handler(request: Request, exc: JernkorsetException):
    return JSONResponse(
        status_code=get_status_code(exc),
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "detail": exc.detail,
            "request_id": request_id_var.get('')
        }
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error_code": "INTERNAL_ERROR",
            "message": "An unexpected error occurred",
            "detail": None,
            "request_id": request_id_var.get('')
        }
    )
```

## Consequences

### Positive

1. **Improved API Reliability**: Clients receive consistent, predictable error responses regardless of failure type.

2. **Better Debugging**: Structured logging with request IDs enables correlation of logs across requests and services.

3. **Clearer Client Error Handling**: Documented error codes allow clients to implement specific handling logic for different error types.

4. **Self-Documenting API**: Pydantic models generate OpenAPI schemas automatically, providing accurate API documentation.

5. **Input Validation**: Malformed requests are rejected early with clear validation messages before reaching business logic.

6. **Production Readiness**: The API becomes suitable for production deployment with proper observability.

### Negative

1. **Increased Complexity**: Additional files and abstractions add cognitive overhead for simple endpoints.

2. **Migration Effort**: Existing code requires updates to use new models and exception patterns.

3. **Response Size**: Error responses include more metadata, slightly increasing payload sizes.

### Risks

1. **Over-Engineering**: For a small project, the full implementation may be more structure than necessary. Mitigation: Implement incrementally, starting with the most critical endpoints.

2. **Breaking Changes**: Clients expecting current error formats will need updates. Mitigation: Document changes and consider API versioning.

## Implementation Details

### File Structure

Following Domain-Driven Design principles:

```
webapp/api/
├── main.py           # FastAPI app, routes, exception handlers
├── models.py         # Pydantic request/response models
├── exceptions.py     # Custom exception classes
├── config.py         # Configuration, logging setup
├── modernizer.py     # Text modernization service (existing)
└── test_*.py         # Test files
```

### Implementation Order

1. **Phase 1**: Create `models.py` with Pydantic schemas
2. **Phase 2**: Create `exceptions.py` with custom exceptions
3. **Phase 3**: Create `config.py` with logging configuration
4. **Phase 4**: Update `main.py` with exception handlers and middleware
5. **Phase 5**: Add response model declarations to endpoints
6. **Phase 6**: Write tests for error scenarios

### Example Refactored Endpoint

```python
@app.get(
    "/letters/{letter_id}",
    response_model=LetterDetail,
    responses={
        404: {"model": ErrorResponse, "description": "Letter not found"},
        400: {"model": ErrorResponse, "description": "Invalid letter ID"}
    }
)
async def read_letter(letter_id: int):
    if letter_id < 1:
        raise InvalidLetterIdError(letter_id, "Letter ID must be positive")

    if letter_id > len(letters):
        raise LetterNotFoundError(letter_id)

    return letters[letter_id - 1]
```

### Dependencies

No new dependencies required. Uses existing FastAPI and Pydantic packages.

## References

- [FastAPI Error Handling Documentation](https://fastapi.tiangolo.com/tutorial/handling-errors/)
- [Pydantic V2 Documentation](https://docs.pydantic.dev/latest/)
- [RFC 7807 - Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc7807)
- [Domain-Driven Design by Eric Evans](https://www.domainlanguage.com/ddd/)

## Implementation Status

**Status**: ✅ Implemented (February 2026)

### Completed Items

1. **Domain Models** (`webapp/api/domain/models.py`):
   - `LetterSummary`, `Letter`, `ErrorResponse`, `ModernizationRequest/Response`
   - Full Pydantic validation with Field constraints

2. **Custom Exceptions** (`webapp/api/domain/exceptions.py`):
   - `JernkorsetAPIError` base class with error_code, message, detail, status_code
   - Specific exceptions: `LetterNotFoundError`, `InvalidLetterIdError`, `DataLoadError`, `ModernizationError`

3. **Configuration** (`webapp/api/config.py`):
   - pydantic-settings based `Settings` class
   - Environment variable support with validation

4. **API Error Handlers** (`webapp/api/main.py`):
   - Global exception handlers for custom exceptions
   - Request ID middleware for tracing
   - Structured JSON error responses

5. **Test Coverage**:
   - Unit tests: `tests/api/unit/` (pytest)
   - E2E tests: `tests/e2e/website.spec.ts` (24 Playwright tests)
   - Docker integration: `docker compose run --rm e2e`

### Verification

Run tests to verify implementation:
```bash
# Unit tests
cd tests/api && pytest

# E2E tests (local)
cd tests/e2e && npm test

# E2E tests (Docker)
docker compose run --rm e2e
```
