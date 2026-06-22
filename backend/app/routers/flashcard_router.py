import logging
import random
import re
import uuid
from datetime import datetime
from typing import List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import get_current_user
from app.database import get_sets_collection
from app.models import (
    Card,
    GenerateRequest,
    ReviewUpdateRequest,
    SaveFlashcardSetRequest,
)
from app import nlp_engine

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Helpers ────────────────────────────────────────────────────────────────────

def _serialize_set(doc: dict) -> dict:
    """Convert MongoDB document to JSON-serialisable dict."""
    doc["id"] = str(doc.pop("_id"))
    doc["user_id"] = str(doc["user_id"])
    if isinstance(doc.get("created_at"), datetime):
        doc["created_at"] = doc["created_at"].isoformat()
    for card in doc.get("cards", []):
        if isinstance(card.get("last_reviewed"), datetime):
            card["last_reviewed"] = card["last_reviewed"].isoformat()
    return doc


# ── Difficulty / weight constants ───────────────────────────────────────────────
WEIGHT_KNOWN_DELTA   = 0.1   # subtract on correct answer
WEIGHT_UNKNOWN_DELTA = 0.3   # add on incorrect answer
WEIGHT_MIN           = 0.1
WEIGHT_MAX           = 3.0


def _sort_cards_by_weight(cards: list) -> list:
    """
    Sort cards so the hardest (highest difficulty_weight) appear first.
    Cards within the same weight bucket are shuffled to avoid a fixed order.

    Bucket boundaries:
      hard   : weight > 2.0
      medium : 1.0 < weight <= 2.0
      easy   : weight <= 1.0
    """
    def bucket(card):
        w = card.get("difficulty_weight", 1.0)
        if w > 2.0:
            return 0   # hard  — show first
        if w > 1.0:
            return 1   # medium
        return 2       # easy  — show last

    # Group by bucket
    groups: dict[int, list] = {0: [], 1: [], 2: []}
    for card in cards:
        groups[bucket(card)].append(card)

    # Shuffle within each bucket for variety
    for g in groups.values():
        random.shuffle(g)

    return groups[0] + groups[1] + groups[2]


def _text_to_cards(text: str) -> List[dict]:
    """
    Stub NLP: split text into sentences, group every 2 sentences into a card.
    Sentence 1  → question (prefixed with 'What is…?')
    Sentence 2  → answer
    """
    # Split on sentence-ending punctuation followed by whitespace or end-of-string
    raw = re.split(r"(?<=[.!?])\s+", text.strip())
    sentences = [s.strip() for s in raw if s.strip()]

    cards = []
    for i in range(0, len(sentences) - 1, 2):
        q_raw = sentences[i]
        answer = sentences[i + 1]

        # Build question
        if q_raw.endswith("?"):
            question = q_raw
        else:
            body = q_raw.rstrip(".!?")
            question = f"What is {body[0].lower() + body[1:]}?"

        cards.append(
            {
                "id": str(uuid.uuid4()),
                "question": question,
                "answer": answer,
                "known_count": 0,
                "unknown_count": 0,
                "last_reviewed": None,
                "difficulty_weight": 1.0,
            }
        )
    return cards


# ── Routes ─────────────────────────────────────────────────────────────────────

@router.get("", summary="Get all flashcard sets for the logged-in user")
async def get_flashcard_sets(current_user=Depends(get_current_user)):
    sets_col = get_sets_collection()
    cursor = sets_col.find({"user_id": ObjectId(str(current_user["_id"]))}).sort(
        "created_at", -1
    )
    sets = []
    async for doc in cursor:
        sets.append(_serialize_set(doc))
    return {"sets": sets}


@router.get("/health/nlp", summary="Check AI model loading status")
async def nlp_health(current_user=Depends(get_current_user)):
    """
    Returns whether spaCy and the HuggingFace QG model are loaded and ready.
    Useful for diagnosing slow first-request behaviour.
    """
    return nlp_engine.get_model_status()


@router.post("/generate", summary="Generate flashcards from text using AI (spaCy + T5 QG)")
async def generate_flashcards(
    request: GenerateRequest, current_user=Depends(get_current_user)
):
    """
    Attempts AI generation (spaCy NER + HuggingFace T5 question-generation).
    Falls back to the sentence-pair stub if the NLP models are not installed.
    """
    # ── Try AI generation ──────────────────────────────────────────────────────
    try:
        cards = nlp_engine.generate_flashcards(request.text)
        logger.info(f"AI engine generated {len(cards)} cards for '{request.title}'")
        return {"title": request.title, "cards": cards, "source": "ai"}

    except RuntimeError as exc:
        # Models not installed / failed to load → fall back to stub
        logger.warning(f"AI engine unavailable ({exc}), falling back to stub")
        cards = _text_to_cards(request.text)
        if not cards:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    "AI models are not installed and the text could not be split "
                    "into sentence pairs either. "
                    f"Install models with: pip install transformers torch spacy "
                    f"&& python -m spacy download en_core_web_sm"
                ),
            )
        return {"title": request.title, "cards": cards, "source": "stub"}

    except ValueError as exc:
        # Models loaded but input was unsuitable
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        )


@router.post(
    "/save",
    status_code=status.HTTP_201_CREATED,
    summary="Save a flashcard set to the database",
)
async def save_flashcard_set(
    request: SaveFlashcardSetRequest, current_user=Depends(get_current_user)
):
    sets_col = get_sets_collection()
    cards_data = [card.model_dump() for card in request.cards]

    doc = {
        "user_id": ObjectId(str(current_user["_id"])),
        "title": request.title,
        "cards": cards_data,
        "created_at": datetime.utcnow(),
    }
    result = await sets_col.insert_one(doc)
    return {"id": str(result.inserted_id), "message": "Flashcard set saved successfully"}


@router.get("/{set_id}", summary="Get a single flashcard set, cards sorted by difficulty")
async def get_flashcard_set(set_id: str, current_user=Depends(get_current_user)):
    sets_col = get_sets_collection()
    try:
        obj_id = ObjectId(set_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid set ID")

    doc = await sets_col.find_one(
        {"_id": obj_id, "user_id": ObjectId(str(current_user["_id"]))}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard set not found")

    serialised = _serialize_set(doc)

    # Sort cards: hardest first, shuffled within weight buckets
    serialised["cards"] = _sort_cards_by_weight(serialised.get("cards", []))

    return serialised


@router.post("/{set_id}/review", summary="Update known/unknown status + adjust difficulty weight")
async def update_review_status(
    set_id: str,
    request: ReviewUpdateRequest,
    current_user=Depends(get_current_user),
):
    """
    Adjusts the card's difficulty_weight based on the user's answer:
      Known          → weight − 0.1  (clamped to min 0.1)
      Need Practice  → weight + 0.3  (clamped to max 3.0)
    Also increments the appropriate count and records last_reviewed.
    Returns the new weight so the frontend can update the indicator immediately.
    """
    sets_col = get_sets_collection()
    try:
        obj_id = ObjectId(set_id)
    except Exception:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid set ID")

    # Fetch the full document so we can read the current weight
    doc = await sets_col.find_one(
        {"_id": obj_id, "user_id": ObjectId(str(current_user["_id"]))}
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flashcard set not found")

    # Locate the specific card
    target_card = next(
        (c for c in doc.get("cards", []) if c["id"] == request.card_id), None
    )
    if not target_card:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found in set")

    # Compute new difficulty_weight with clamping
    current_weight = float(target_card.get("difficulty_weight", 1.0))
    if request.known:
        new_weight = round(max(WEIGHT_MIN, current_weight - WEIGHT_KNOWN_DELTA), 4)
        count_field = "known_count"
    else:
        new_weight = round(min(WEIGHT_MAX, current_weight + WEIGHT_UNKNOWN_DELTA), 4)
        count_field = "unknown_count"

    # Atomic update using positional operator
    await sets_col.update_one(
        {"_id": obj_id, "cards.id": request.card_id},
        {
            "$inc": {f"cards.$.{count_field}": 1},
            "$set": {
                "cards.$.difficulty_weight": new_weight,
                "cards.$.last_reviewed": datetime.utcnow(),
            },
        },
    )

    logger.info(
        f"Card {request.card_id[:8]}… weight {current_weight:.2f} → {new_weight:.2f} "
        f"({'known' if request.known else 'unknown'})"
    )

    return {
        "message": "Review status updated",
        "known": request.known,
        "previous_weight": current_weight,
        "new_weight": new_weight,
    }
