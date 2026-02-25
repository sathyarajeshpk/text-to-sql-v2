from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
import hashlib
import os

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
ALGORITHM = "HS256"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _normalize(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_password(password: str):
    return pwd_context.hash(_normalize(password))


def verify_password(password: str, hashed: str):
    return pwd_context.verify(_normalize(password), hashed)


def create_token(email: str):
    expire = datetime.utcnow() + timedelta(hours=24)
    payload = {"sub": email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)