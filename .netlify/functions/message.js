const axios = require('axios');

// Configuration Hugging Face - Modèle sans censure
const HF_API_TOKEN = process.env.HF_API_TOKEN || 'hf_YOUR_TOKEN_HERE';
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.2'; // Modèle puissant et peu censuré

// Alternative: meta-llama/Llama-2-7b-chat-hf (encore moins censuré)
// ou: NousResearch/Nous-Hermes-2-Mistral-7B-DPO

exports.handler = async (event, context) => {
  // Accepter uniquement POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Méthode non autorisée' })
    };
  }

  try {
    const { message } = JSON.parse(event.body);

    if (!message || !message.trim()) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Message vide' })
      };
    }

    if (!HF_API_TOKEN || HF_API_TOKEN === 'hf_YOUR_TOKEN_HERE') {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: '✧ Les tokens API ne sont pas configurés. Ajoute HF_API_TOKEN dans les variables d\'environnement Netlify.' 
        })
      };
    }

    console.log('📨 Message reçu:', message);
    console.log('🤖 Utilisant le modèle:', HF_MODEL);

    // Appel à l'API Hugging Face
    const response = await axios.post(
      `https://api-inference.huggingface.co/models/${HF_MODEL}`,
      {
        inputs: message,
        parameters: {
          max_new_tokens: 200,
          temperature: 0.9,
          top_p: 0.95,
          repetition_penalty: 1.1,
          do_sample: true
        },
        options: {
          use_cache: false,
          wait_for_model: true
        }
      },
      {
        headers: {
          Authorization: `Bearer ${HF_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    console.log('✅ Réponse brute:', response.data);

    // Parser la réponse
    let reply = '';
    
    if (Array.isArray(response.data) && response.data[0]) {
      if (response.data[0].generated_text) {
        reply = response.data[0].generated_text;
      } else if (response.data[0]) {
        reply = JSON.stringify(response.data[0]);
      }
    } else if (response.data.generated_text) {
      reply = response.data.generated_text;
    } else {
      reply = JSON.stringify(response.data);
    }

    // Nettoyer la réponse (enlever le prompt si dupliqué)
    reply = reply.replace(message, '').trim();
    
    // Limiter à 250 caractères max
    if (reply.length > 250) {
      reply = reply.substring(0, 250) + '...';
    }

    // Si la réponse est vide, réessayer ou utiliser un fallback
    if (!reply || reply.length < 5) {
      reply = '✧ Le cosmos pense profondément à ta question...';
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: reply })
    };

  } catch (error) {
    console.error('❌ Erreur complète:', error.message);
    console.error('Status:', error.response?.status);
    console.error('Data:', error.response?.data);

    // Réponses fallback selon le type d'erreur
    const fallbacks = {
      429: '✧ Le cosmos est très occupé en ce moment... Réessaie dans quelques secondes.',
      503: '✧ Les serveurs du cosmos sont en maintenance... Reviens plus tard.',
      401: '✧ Erreur d\'authentification - Configure ta clé API HF_API_TOKEN dans Netlify.',
      default: '✧ Les étoiles sont silencieuses... ' + error.message.substring(0, 30)
    };

    const errorCode = error.response?.status;
    const fallback = fallbacks[errorCode] || fallbacks.default;

    return {
      statusCode: 200, // Retourner 200 même en erreur pour afficher le fallback
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: fallback })
    };
  }
};
