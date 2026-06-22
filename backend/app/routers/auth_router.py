from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, HTTPException, status

from app.auth import hash_password, verify_password, create_access_token
from app.database import get_users_collection
from app.models import UserSignupRequest, UserLoginRequest, TokenResponse, UserResponse

router = APIRouter()


def _build_token_response(user_id: str, name: str, email: str) -> TokenResponse:
    token = create_access_token({"sub": user_id})
    return TokenResponse(
        access_token=token,
        user=UserResponse(id=user_id, name=name, email=email),
    )


@router.post(
    "/signup",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new user",
)
async def signup(request: UserSignupRequest):
    users_col = get_users_collection()

    # Check duplicate email
    existing = await users_col.find_one({"email": request.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already exists",
        )

    user_doc = {
        "name": request.name,
        "email": request.email,
        "hashed_password": hash_password(request.password),
        "created_at": datetime.utcnow(),
    }
    result = await users_col.insert_one(user_doc)
    user_id = str(result.inserted_id)

    return _build_token_response(user_id, request.name, request.email)


@router.post(
    "/login",
    response_model=TokenResponse,
    summary="Login and receive JWT token",
)
async def login(request: UserLoginRequest):
    users_col = get_users_collection()

    user = await users_col.find_one({"email": request.email})
    if not user or not verify_password(request.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Wrong email or password",
        )

    user_id = str(user["_id"])
    return _build_token_response(user_id, user["name"], user["email"])
