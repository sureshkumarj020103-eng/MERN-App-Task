const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const OpenAI = require('openai');
const dotenv = require('dotenv');
const rateLimit = require('express-rate-limit');
const Query = require('../models/Query');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Add rate limiting middleware
const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Limit each IP to 10 requests per minute
  message: { error: 'Too many AI requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Helper function for retry logic
async function makeOpenRouterRequest(openai, requestConfig, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await openai.chat.completions.create(requestConfig);
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      // Handle specific error types
      if (error.status === 429) {
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      if (error.status === 401) {
        throw new Error('Invalid API key configuration');
      }
      
      if (error.status === 503) {
        throw new Error('Model temporarily unavailable');
      }
      
      // For other errors, don't retry
      throw error;
    }
  }
}

const PORT =  process.env.PORT || 5000;
const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('✅ MongoDB connected successfully to:', MONGO_URI.split('@')[1]?.split('/')[0] || 'database');
})
.catch((err) => {
  console.error('❌ MongoDB connection error:', err.message);
  console.log('Please check your MONGODB_URI in .env file');
});

// Additional connection event listeners
mongoose.connection.on('connected', () => {
  console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('📡 Mongoose disconnected');
});

app.post('/api/ask-ai', aiRateLimit, async (req, res) => {
  const { prompt } = req.body;
  // Validate input
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Valid prompt is required' });
  }
  if (prompt.length > 2000) {
    return res.status(400).json({ error: 'Prompt too long (max 2000 characters)' });
  }
  // Get API key from environment only
  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  if (!OPENROUTER_API_KEY) {
    console.error('❌ OpenRouter API key not found in environment variables');
    return res.status(500).json({ error: 'AI service not configured' });
  }
  try {
    // Initialize OpenAI SDK with OpenRouter
    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: OPENROUTER_API_KEY,
      defaultHeaders: {
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:5173',
        'X-OpenRouter-Title': process.env.SITE_NAME || 'MERN App Task',
      },
    });
    // Use free models router for better availability
    const useModel = process.env.OPENROUTER_MODEL || 'openrouter/free';
    const requestConfig = {
      model: useModel,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Provide clear, concise answers.'
        },
        {
          role: 'user',
          content: prompt.trim()
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    };
    // Make request with retry logic
    const completion = await makeOpenRouterRequest(openai, requestConfig);
    // Extract response
    let answer = '';
    if (completion?.choices?.[0]?.message?.content) {
      answer = completion.choices[0].message.content.trim();
    } else {
      console.warn('Unexpected response format:', completion);
      answer = 'Sorry, I received an unexpected response format.';
    }
    return res.json({ 
      prompt: prompt.trim(), 
      response: answer,
      model: useModel 
    });
  } catch (error) {
    console.error('❌ OpenRouter API error:', error.message);
    
    // Return user-friendly error messages
    if (error.message.includes('Rate limit')) {
      return res.status(429).json({ 
        error: 'Too many requests. Please wait a moment and try again.',
        retryAfter: 60 
      });
    }
    
    if (error.message.includes('Invalid API key')) {
      return res.status(401).json({ error: 'Authentication failed' });
    }
    
    if (error.message.includes('Model temporarily unavailable')) {
      return res.status(503).json({ error: 'AI service temporarily unavailable' });
    }
    
    if (error.code === 'ENOTFOUND') {
      return res.status(503).json({ error: 'Network connection failed' });
    }
    return res.status(500).json({ 
      error: 'AI request failed', 
      message: 'Please try again later' 
    });
  }
});

app.post('/api/save', async (req, res) => {
  const { prompt, response } = req.body;
  if (!prompt || !response) {
    return res.status(400).send({ error: 'Prompt and response are required' });
  }
  try {
    const query = new Query({ prompt, response });
    await query.save();
    res.json(query);
  } catch (err) {
    console.error('Mongo save error', err);
    res.status(500).json({ error: 'Failed to save query' });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const items = await Query.find().sort({ createdAt: -1 }).limit(50);
    res.json(items);
  } catch (err) {
    console.error('❌ History fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const path = require('path');
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
