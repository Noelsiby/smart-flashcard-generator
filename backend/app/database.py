from motor.motor_asyncio import AsyncIOMotorClient
from app.config import settings

client: AsyncIOMotorClient = None
db = None
users_collection = None
flashcard_sets_collection = None


async def connect_db():
    """Connect to MongoDB Atlas and create indexes."""
    global client, db, users_collection, flashcard_sets_collection

    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users_collection = db["users"]
    flashcard_sets_collection = db["flashcard_sets"]

    # Create indexes
    await users_collection.create_index("email", unique=True)
    await flashcard_sets_collection.create_index("user_id")
    print("Connected to MongoDB Atlas")


async def close_db():
    """Close the MongoDB connection."""
    global client
    if client:
        client.close()
        print("MongoDB connection closed")


def get_users_collection():
    return users_collection


def get_sets_collection():
    return flashcard_sets_collection
