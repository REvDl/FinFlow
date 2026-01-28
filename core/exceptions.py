from typing import Dict, Type

from starlette import status


class FinFlowException(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)

class TokenHasExpired(FinFlowException): pass
class TokenInvalid(FinFlowException): pass
class TokenVerificationFailed(FinFlowException): pass
class TokenMissing(FinFlowException): pass
class TokenMissingType(FinFlowException): pass
class AuthUserAlreadyExists(FinFlowException): pass
class AuthInvalidLoginOrPassword(FinFlowException): pass
class TransactionNotFound(FinFlowException):pass
class CategoryNotFound(FinFlowException):pass
class UserNotFound(FinFlowException):pass
class DataError(FinFlowException): pass

ERROR_MAP: Dict[Type[FinFlowException], int] = {
    AuthUserAlreadyExists: status.HTTP_409_CONFLICT,
    AuthInvalidLoginOrPassword: status.HTTP_401_UNAUTHORIZED,
    TokenHasExpired: status.HTTP_401_UNAUTHORIZED,
    TokenInvalid: status.HTTP_401_UNAUTHORIZED,
    TokenMissing: status.HTTP_401_UNAUTHORIZED,
    TokenMissingType: status.HTTP_401_UNAUTHORIZED,
    TokenVerificationFailed: status.HTTP_401_UNAUTHORIZED,
    TransactionNotFound: status.HTTP_404_NOT_FOUND,
    CategoryNotFound: status.HTTP_404_NOT_FOUND,
    UserNotFound: status.HTTP_404_NOT_FOUND,
    DataError: status.HTTP_422_UNPROCESSABLE_CONTENT,
}