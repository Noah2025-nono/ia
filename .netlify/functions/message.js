const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Charger la config
let config;
try {
  const configPath = path.join(__dirname, '../../ai-config.json');
  config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
} catch (error) {
  console.error('Erreur chargement config:', error);
  config = {
    ai: {
      model: 'mistral',
      endpoint: 'http://localhost:11434/api/generate',
      settings: { temperature: 0.7, top_p: 0.9, top_k: 40, num_predict: 128, stream: false }
    },
    display: { max_response_length: 120 },
    fallback: { enabled: true, responses: ['Les étoiles sont silencieuses...'] }
  };
}

exports.handler = async (event, context) => {
  // Accepter uniquement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  try {
    const { message } = JSON.parse(event.body);

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message vide' })
      };
    }

    // Appel à l'API Ollama
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
    
    // Limiter la longueur
    if (reply.length > config.display.max_response_length) {
      reply = reply.substring(0, config.display.max_response_length) + '...';
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ response: reply })
    };

  } catch (error) {
    console.error('Erreur Ollama:', error.message);
    
    // Fallback si l'API échoue
    if (config.fallback && config.fallback.enabled) {
      const fallback = config.fallback.responses[
        Math.floor(Math.random() * config.fallback.responses.length)
      ];
      return {
        statusCode: 200,
        body: JSON.stringify({ response: fallback })
      };
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Impossible de contacter le serveur IA' })
    };
  }
};
