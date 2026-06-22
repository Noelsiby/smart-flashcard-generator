import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

async def test_connection():
    try:
        url = os.getenv('MONGODB_URL')
        print(f"Connecting to: {url}")
        client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
        # Attempt to get server info to force a connection
        info = await client.server_info()
        print("\n=== MONGODB CONNECTION SUCCESSFUL ===")
        print(f"MongoDB Version: {info.get('version')}")
    except Exception as e:
        print("\n=== MONGODB CONNECTION FAILED ===")
        print(f"Error: {e}")
    finally:
        if 'client' in locals():
            client.close()

if __name__ == "__main__":
    asyncio.run(test_connection())
