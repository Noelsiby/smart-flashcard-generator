"""
nlp_engine.py — AI Flashcard Generation

Pipeline:
  1. spaCy  → sentence segmentation + named-entity recognition + noun chunks
  2. Filter → keep sentences that contain at least one entity or long noun chunk
  3. T5 QG  → generate a question for each candidate sentence
  4. Return → list of flashcard dicts (question + answer + metadata)

Model loading is LAZY: models are loaded once on the first call to
generate_flashcards() and cached for the lifetime of the process.
This keeps startup fast even when the model has not been downloaded yet.

Graceful degradation: if either model fails to load, generate_flashcards()
raises a RuntimeError whose message is surfaced to the API caller so the
frontend can display a helpful error.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ── Module-level singletons (populated on first use) ──────────────────────────
_spacy_nlp: Any = None         # spacy.Language instance
_qg_pipeline: Any = None       # transformers Pipeline instance
_models_ready: bool = False
_model_error: Optional[str] = None

# ── Configuration ──────────────────────────────────────────────────────────────
QG_MODEL = "mrm8488/t5-base-finetuned-question-generation-ap"
MIN_SENTENCE_CHARS = 25        # Ignore very short sentences
MAX_CARDS = 20                 # Cap output to avoid huge responses
QG_MAX_NEW_TOKENS = 64
QG_NUM_BEAMS = 4


# ── Model Loading ──────────────────────────────────────────────────────────────

def _load_models() -> None:
    """
    Load spaCy and the HuggingFace QG pipeline.
    Called automatically before the first generation request.
    Safe to call multiple times — only runs once.
    """
    global _spacy_nlp, _qg_pipeline, _models_ready, _model_error

    # Already loaded (success or permanent failure)
    if _models_ready or _model_error:
        return

    # ── Step A: spaCy ─────────────────────────────────────────────────────────
    try:
        import spacy  # noqa: PLC0415
        logger.info("Loading spaCy model 'en_core_web_sm'…")
        _spacy_nlp = spacy.load("en_core_web_sm")
        logger.info("✅ spaCy model ready")
    except OSError:
        _model_error = (
            "spaCy model 'en_core_web_sm' is not installed. "
            "Fix: python -m spacy download en_core_web_sm"
        )
        logger.error(_model_error)
        return
    except ImportError:
        _model_error = (
            "spaCy is not installed. Fix: pip install spacy"
        )
        logger.error(_model_error)
        return
    except Exception as exc:  # noqa: BLE001
        _model_error = f"Failed to load spaCy: {exc}"
        logger.error(_model_error)
        return

    # ── Step B: HuggingFace T5 QG pipeline ───────────────────────────────────
    try:
        from transformers import pipeline  # noqa: PLC0415
        logger.info(
            f"Loading HuggingFace model '{QG_MODEL}' "
            "(first run will download ~900 MB — this may take a few minutes)…"
        )
        _qg_pipeline = pipeline(
            "text2text-generation",
            model=QG_MODEL,
            # Use CPU by default; change device=0 for GPU
            device=-1,
        )
        logger.info("✅ Question-generation model ready")
    except ImportError:
        _model_error = (
            "transformers / torch are not installed. "
            "Fix: pip install transformers torch sentencepiece"
        )
        logger.error(_model_error)
        return
    except Exception as exc:  # noqa: BLE001
        _model_error = f"Failed to load HuggingFace model: {exc}"
        logger.error(_model_error)
        return

    _models_ready = True


def get_model_status() -> Dict[str, Any]:
    """Return current model status — used by the /health/nlp endpoint."""
    return {
        "ready": _models_ready,
        "error": _model_error,
        "spacy_loaded": _spacy_nlp is not None,
        "qg_pipeline_loaded": _qg_pipeline is not None,
        "model": QG_MODEL,
    }


# ── Internal helpers ───────────────────────────────────────────────────────────

def _make_card(question: str, answer: str) -> Dict[str, Any]:
    """Create a flashcard dict with all required fields."""
    return {
        "id": str(uuid.uuid4()),
        "question": question,
        "answer": answer,
        "known_count": 0,
        "unknown_count": 0,
        "last_reviewed": None,
        "difficulty_weight": 1.0,
    }


def _is_informative(sent_doc: Any, entities: List[Tuple[str, str]], noun_chunks: List[str]) -> bool:
    """
    Return True if this sentence is worth turning into a flashcard.
    Heuristic: it contains at least one named entity OR a multi-word noun chunk.
    """
    sent_start = sent_doc.start
    sent_end   = sent_doc.end

    # Check if any entity falls within this sentence's token range
    for ent in sent_doc.ents:
        if ent.start >= sent_start and ent.end <= sent_end:
            return True

    # Check for multi-word noun chunks (single words are usually not informative enough)
    for chunk in sent_doc.noun_chunks:
        if chunk.start >= sent_start and chunk.end <= sent_end and len(chunk) > 1:
            return True

    return False


def _generate_question(sentence: str) -> Optional[str]:
    """
    Run the T5 QG model on a single sentence.
    Returns the generated question string, or None if generation failed.
    """
    # Input format expected by mrm8488/t5-base-finetuned-question-generation-ap
    input_text = f"generate question: {sentence}"

    try:
        results = _qg_pipeline(
            input_text,
            max_new_tokens=QG_MAX_NEW_TOKENS,
            num_beams=QG_NUM_BEAMS,
            early_stopping=True,
            do_sample=False,
        )
        question = results[0]["generated_text"].strip()
    except Exception as exc:  # noqa: BLE001
        logger.warning(f"QG failed for sentence '{sentence[:60]}…': {exc}")
        return None

    if not question:
        return None

    # Ensure question ends with '?'
    if not question.endswith("?"):
        question += "?"

    # Skip if the model just echoed the input
    if question.lower().strip("?") == sentence.lower().strip("?.!"):
        return None

    return question


# ── Public API ─────────────────────────────────────────────────────────────────

def generate_flashcards(text: str) -> List[Dict[str, Any]]:
    """
    Generate flashcards from raw study-note text.

    Steps
    -----
    1. Load models (lazy, cached after first call).
    2. Segment text into sentences using spaCy.
    3. Extract named entities (NER) and noun chunks for sentence filtering.
    4. For each informative sentence, call the T5 QG pipeline.
    5. Return a list of flashcard dicts.

    Raises
    ------
    RuntimeError  — if models failed to load
    ValueError    — if no flashcards could be generated from the input
    """
    # ── STEP 1: Ensure models are ready ───────────────────────────────────────
    _load_models()
    if not _models_ready:
        raise RuntimeError(
            f"NLP models are not ready. {_model_error or 'Unknown error.'}"
        )

    # ── STEP 2: Sentence segmentation ─────────────────────────────────────────
    doc = _spacy_nlp(text)

    sentences = [
        sent for sent in doc.sents
        if len(sent.text.strip()) >= MIN_SENTENCE_CHARS
    ]

    if not sentences:
        raise ValueError(
            "No meaningful sentences found. "
            f"Please provide at least one sentence longer than {MIN_SENTENCE_CHARS} characters."
        )

    # ── STEP 3: Entity + keyword extraction ───────────────────────────────────
    entities: List[Tuple[str, str]] = [(ent.text, ent.label_) for ent in doc.ents]
    noun_chunks: List[str] = [chunk.text for chunk in doc.noun_chunks]

    logger.info(
        f"spaCy: {len(sentences)} sentences | "
        f"{len(entities)} entities | "
        f"{len(noun_chunks)} noun chunks"
    )

    # ── STEP 4: Filter to informative sentences ────────────────────────────────
    # If NER finds nothing we fall back to using all sentences to avoid
    # returning an empty result on plain-prose input.
    informative = [s for s in sentences if _is_informative(s, entities, noun_chunks)]
    if not informative:
        logger.info("No entity-rich sentences found — using all sentences as fallback")
        informative = sentences

    # Respect the max-card cap
    informative = informative[:MAX_CARDS]

    # ── STEP 5: Generate questions ─────────────────────────────────────────────
    flashcards: List[Dict[str, Any]] = []

    for sent in informative:
        sentence_text = sent.text.strip()
        question = _generate_question(sentence_text)

        if question:
            # STEP 4 in spec: answer IS the original sentence
            flashcards.append(_make_card(question, sentence_text))
        else:
            logger.warning(f"Skipped (no question generated): '{sentence_text[:80]}'")

    # ── STEP 5: Return ─────────────────────────────────────────────────────────
    if not flashcards:
        raise ValueError(
            "Could not generate questions from the provided text. "
            "Try using more descriptive, factual sentences."
        )

    logger.info(f"Generated {len(flashcards)} flashcard(s)")
    return flashcards
