# MERN App Task - React Flow AI Chat Interface

## Tech Stack
- **Frontend**: React + React Flow (Vite)
- **Backend**: Node.js + Express + OpenAI SDK
- **Database**: MongoDB (Atlas or local)
- **AI**: OpenRouter free models

## Features
- React Flow UI with input/result nodes connected by edge
- Enter prompt → Click "Run Flow" → AI response in result node
- Save conversations to MongoDB
- View chat history

## Setup Steps

### 1. Backend
1. `cd backend && npm install`
2. Create `.env` with:
   ```
   OPENROUTER_API_KEY=your_api_key_here  # Get from https://openrouter.ai/keys
   MONGODB_URI=mongodb://127.0.0.1:27017/mern_app_task
   OPENROUTER_MODEL=openrouter/free
   SITE_URL=http://localhost:5173
   SITE_NAME=MERN App Task
   ```
3. `npm start` (port 5000)

### 2. Frontend
1. `cd frontend && npm install`
2. `npm run dev` (port 5173)

## API Endpoints
- `POST /api/ask-ai` - Get AI response
- `POST /api/save` - Save conversation
- `GET /api/history` - Get saved chats

## Notes
- Get OpenRouter API key from [openrouter.ai/keys](https://openrouter.ai/keys)
- Free models have 50 requests/day limit without credits
- Uses `openrouter/free` model router for better availability
