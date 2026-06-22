from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
import uuid


# ── Auth Models ────────────────────────────────────────────────────────────────

class UserSignupRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)


class UserLoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Flashcard Models ───────────────────────────────────────────────────────────

class Card(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    question: str
    answer: str
    known_count: int = 0
    unknown_count: int = 0
    last_reviewed: Optional[datetime] = None
    difficulty_weight: float = 1.0


class GenerateRequest(BaseModel):
    text: str = Field(..., min_length=10)
    title: str = Field(..., min_length=1)


class SaveFlashcardSetRequest(BaseModel):
    title: str = Field(..., min_length=1)
    cards: List[Card] = Field(..., min_length=1)


class ReviewUpdateRequest(BaseModel):
    card_id: str
    known: bool


# ── Response Models ────────────────────────────────────────────────────────────

class FlashcardSetResponse(BaseModel):
    id: str
    user_id: str
    title: str
    cards: List[Card]
    created_at: datetime


class FlashcardSetsListResponse(BaseModel):
    sets: List[FlashcardSetResponse]
