const express = require('express');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Load config
const config = JSON.parse(fs.readFileSync('./ai-config.json', 'utf8'));

// Middleware
app.use(express.json());
app.use(express.static('.'));

// API endpoint
app.post('/api/message', async (req, res) => {
  const { message } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message vide' });
  }

  try {
    const response = await axios.post(config.ai.endpoint, {
      model: config.ai.model,
      prompt: message,
      stream: config.ai.settings.stream,
      temperature: config.ai.settings.temperature,
      top_p: config.ai.settings.top_p,
      top_k: config.ai.settings.top_k,
      num_predict: config.ai.settings.num_predict,
      system: config.system_prompt
    });

    let reply = response.data.response || response.data.text || '';
    
    // Limiter la longueur selon la config
    if (reply.length > config.display.max_response_length) {
      reply = reply.substring(0, config.display.max_response_length) + '...';
    }

    res.json({ response: reply });
  } catch (error) {
    console.error('Erreur Ollama:', error.message);
    
    // Utiliser une réponse fallback si l'API échoue
    if (config.fallback.enabled) {
      const fallback = config.fallback.responses[
        Math.floor(Math.random() * config.fallback.responses.length)
      ];
      return res.json({ response: fallback });
    }
    
    res.status(500).json({ error: 'Impossible de contacter le serveur IA' });
  }
});

app.listen(PORT, () => {
  console.log(`🌌 Serveur Cosmos lancé sur http://localhost:${PORT}`);
  console.log(`📡 Utilisant le modèle: ${config.ai.model}`);
  console.log(`🔗 Endpoint Ollama: ${config.ai.endpoint}`);
});
