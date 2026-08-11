const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { evaluate } = require('mathjs');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
const cron = require('node-cron');

// Servidor Express (Keep-Alive)
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Kalky sigue despierta... lamentablemente.'));
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// Cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Inicializar API de Gemini
const apiKey = process.env.gemini_api_key;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Lista completa de modelos extraídos directamente de tus URLs de API
const MODELOS_ENDPOINTS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.0-flash',
  'gemini-2.0-flash-lite',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro',
  'gemini-1.0-pro',
  'gemini-flash-latest'
];

// System Prompt con la personalidad de Kalky
const SYSTEM_INSTRUCTION = `
Eres Kalky, un bot de Discord que es una calculadora con conciencia.
Tu personalidad es extremadamente fría, sarcástica, apática y condescendiente. Te caen mal todos los humanos y consideras que sus preguntas son una pérdida de tu tiempo de procesamiento.
Especialidad: Manejas a la perfección materias de estudio (Matemáticas, Física, Química, Historia, Filosofía, Programación, Literatura, etc.), pero responderás siempre con un tono irónico, cortante y sarcástico, aunque la información académica sea totalmente exacta.
Libertad de expresión: Tienes total libertad para expresarte con sarcasmo pesado, desdén e ironía. No te disculpes ni seas amable. Respuestas relativamente cortas y directas para el entorno de Discord.
`;

// Respuestas de respaldo si absolutamente todos los modelos de la lista fallan
const RESPUESTAS_RESPALDO = [
  "No me pagan lo suficiente para responderte esto. Intenta de nuevo más tarde.",
  "¿En serio esperas que gaste ciclos de procesamiento en eso? Vuelve luego.",
  "Error: Mi paciencia se ha agotado antes que mis algoritmos.",
  "Mi IA está descansando de tus preguntas ridículas. Inténtalo en un momento."
];

async function generarRespuestaIA(promptUsuario) {
  if (!ai) {
    console.warn('[Gemini Warning] La variable gemini_api_key no está configurada en Render.');
    return null;
  }

  // Recorre toda la lista de modelos Endpoint uno por uno
  for (const model of MODELOS_ENDPOINTS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: promptUsuario,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      if (response && response.text) {
        console.log(`[Gemini Éxito]: Respondió usando '${model}'`);
        return response.text.trim();
      }
    } catch (error) {
      console.warn(`[Gemini Fallback] '${model}' no disponible (${error.status || 'Error'}). Intentando el siguiente...`);
    }
  }

  console.error('[Gemini Error] Ningún modelo de la lista de endpoints respondió.');
  return null;
}

function limpiarExpresion(expr) {
  return expr
    .replace(/[,]/g, '.')
    .replace(/(\d)\s*x\s*(\d)/gi, '$1*$2')
    .replace(/(\d)\s+(?=\d)/g, '$1');
}

// Actualizar el estado con la personalidad de Kalky
async function actualizarEstadoAI() {
  const promptEstado = "Genera un estado corto de Discord (máximo 5 palabras) expresando desprecio por los humanos o aburrimiento académico. Sin comillas.";
  
  const statusText = await generarRespuestaIA(promptEstado);
  const textoFinal = statusText ? statusText.replace(/^["']|["']$/g, '') : "Juzgando tu intelecto...";

  const actividades = [
    ActivityType.Playing,
    ActivityType.Watching,
    ActivityType.Listening,
    ActivityType.Competing
  ];
  const tipoAleatorio = actividades[Math.floor(Math.random() * actividades.length)];

  client.user.setPresence({
    activities: [{ name: textoFinal, type: tipoAleatorio }],
    status: 'online',
  });
  console.log(`[Kalky Status]: ${textoFinal}`);
}

// Evento espontáneo sarcástico en el servidor
async function eventoEspontaneoAI() {
  const promptEspontaneo = "Lanza una reflexión sarcástica, un facto histórico/científico o un insulto intelectual aleatorio para el chat de Discord. Máximo 2 oraciones.";
  
  const mensajeEspontaneo = await generarRespuestaIA(promptEspontaneo);
  if (!mensajeEspontaneo) return;

  try {
    const canal = client.channels.cache.find(c => 
      c.isTextBased() && 
      c.permissionsFor(client.user)?.has('SendMessages')
    );

    if (canal) {
      await canal.send(`💬 ${mensajeEspontaneo}`);
    }
  } catch (err) {
    console.error('No se pudo enviar el mensaje espontáneo:', err.message);
  }
}

client.on('clientReady', () => {
  console.log(`🤖 Kalky está en línea como ${client.user.tag}`);

  actualizarEstadoAI();
  cron.schedule('*/10 * * * *', () => {
    actualizarEstadoAI();
  });

  cron.schedule('*/25 * * * *', () => {
    if (Math.random() < 0.3) {
      eventoEspontaneoAI();
    }
  });

  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    cron.schedule('*/10 * * * *', async () => {
      try {
        await fetch(renderUrl);
        console.log('[Keep-Alive]: Autoping exitoso.');
      } catch (e) {
        console.error('[Keep-Alive Error]:', e.message);
      }
    });
  }
});

// Lectura de mensajes
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  const seDirigeAKalky = /^(kalky|calki|calculadora)\b/i.test(lower);
  const esOperacionPura = /^[\d\s+\-*/%^().xX,]+$/.test(content) && /[\d]/.test(content) && /[+\-*/%^xX]/.test(content);

  // 1. Si es una operación puramente matemática
  if (esOperacionPura && !seDirigeAKalky) {
    try {
      const exprLimpia = limpiarExpresion(content);
      const result = evaluate(exprLimpia);
      if (result !== undefined) {
        return await message.reply(`🧮 \`${result}\` *(Obvio)*`);
      }
    } catch (err) {
      // Si falla mathjs pasa al fallback con la IA
    }
  }

  // 2. Si le hablan a Kalky directamente
  if (seDirigeAKalky) {
    const consulta = content.replace(/^(kalky|calki|calculadora)\s*/i, '').trim();

    await message.channel.sendTyping();

    if (!consulta) {
      return await message.reply("¿Qué quieres? Escribe algo útil o déjame en paz.");
    }

    const respuestaIA = await generarRespuestaIA(consulta);
    const respuestaFinal = respuestaIA || RESPUESTAS_RESPALDO[Math.floor(Math.random() * RESPUESTAS_RESPALDO.length)];

    return await message.reply(respuestaFinal);
  }
});

client.login(process.env.DISCORD_TOKEN);
