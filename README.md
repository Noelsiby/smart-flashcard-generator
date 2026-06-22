# 🧠 Smart Flashcard Generator
> AI-powered study tool that converts raw notes into 
> smart flashcards using real NLP — not just text splitting.

![Demo](demo.gif)
*(Note: Replace demo.gif with actual recording)*

![Tech Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue)
![Backend](https://img.shields.io/badge/Backend-FastAPI-green)
![Database](https://img.shields.io/badge/Database-MongoDB%20Atlas-brightgreen)
![AI](https://img.shields.io/badge/AI-HuggingFace%20%2B%20spaCy-orange)
![Auth](https://img.shields.io/badge/Auth-JWT%20%2B%20bcrypt-red)

## 🎯 What It Does
A student pastes their study notes on any topic.
The backend processes the text using real NLP techniques
to automatically generate meaningful question and answer 
flashcard pairs. Students then review cards one by one,
marking them as Known or Not Known. Cards marked as 
Not Known appear more frequently in future sessions
using a difficulty weight system — similar to 
spaced repetition learning.

## ✨ Features
- 🔐 Secure signup and login with JWT authentication
- 📝 Paste any study notes and get AI flashcards instantly
- 🤖 Real NLP processing using spaCy and HuggingFace
- 🃏 Smooth card flip animation during review
- 🧠 Smart review system — hard cards appear more often
- 📊 Dashboard showing all flashcard sets with stats
- 📱 Mobile friendly responsive design
- ⚡ Fast async backend with Motor MongoDB driver

## 🤖 How the AI/NLP Works
This is NOT simple text splitting. Here is the real process:

Step 1 — Text Processing with spaCy
- Load the en_core_web_sm language model
- Split notes into sentences using spaCy sentence segmentation
- Extract named entities (people, places, concepts, dates)
- Extract noun chunks as key topic phrases

Step 2 — Question Generation with HuggingFace
- Use T5 model fine-tuned for question generation
- Feed each important sentence as input
- Model generates a natural language question
- Original sentence becomes the answer

Step 3 — Smart Difficulty System
- Each card starts with difficulty_weight = 1.0
- Marking Known: weight decreases by 0.1 (min 0.1)
- Marking Not Known: weight increases by 0.3 (max 3.0)
- Review sessions sort cards by weight (hardest first)
- This mimics spaced repetition learning technique

## 🛠️ Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | React + Vite | Fast HMR, modern tooling |
| Routing | React Router v6 | Clean SPA navigation |
| HTTP Client | Axios | Simple API calls with interceptors |
| Backend | FastAPI (Python) | Async, fast, auto docs |
| Database Driver | Motor (async) | Non-blocking MongoDB I/O |
| Database | MongoDB Atlas | Free cloud tier, flexible schema |
| Authentication | JWT + bcrypt | Secure, stateless auth |
| NLP | spaCy en_core_web_sm | Entity extraction, sentence splitting |
| AI Model | HuggingFace T5 | Question generation from text |
| Frontend Host | Vercel | Free, instant deployment |
| Backend Host | Render | Free Python hosting |

## 🚀 How to Run Locally

### Prerequisites
- Python 3.10 or higher
- Node.js 18 or higher
- MongoDB Atlas account (free)

### Backend Setup
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_sm

Create backend/.env file:
MONGODB_URL=your_mongodb_atlas_connection_string
JWT_SECRET=your_random_secret_key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
DATABASE_NAME=flashcard_app

Start backend:
uvicorn main:app --reload --port 8000

API docs available at: http://localhost:8000/docs

### Frontend Setup
cd frontend
npm install

Create frontend/.env file:
VITE_API_URL=http://localhost:8000

Start frontend:
npm run dev

Open: http://localhost:5173

## 📁 Project Structure
smart-flashcard-generator/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Signup.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Generate.jsx
│   │   │   └── Review.jsx
│   │   ├── components/
│   │   └── App.jsx
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── auth.py
│   │   ├── database.py
│   │   ├── flashcards.py
│   │   └── nlp_engine.py
│   └── requirements.txt
│
└── README.md

## 🔐 Security Features
- Passwords hashed with bcrypt (never stored plain text)
- JWT tokens expire after 24 hours
- Protected API routes require valid token
- Environment variables for all secrets
- .env files excluded from git

## 🌐 Live Demo
- Frontend: YOUR_VERCEL_URL
- Backend API: YOUR_RENDER_URL
- API Documentation: YOUR_RENDER_URL/docs

## 📋 Assignment Details
- Company: GISUL
- Position: Full Stack + AI Developer
- Option: A — Smart Flashcard Generator
- Submitted by: YOUR_NAME
