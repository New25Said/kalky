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

// Lista de modelos Endpoint
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

// Memoria RAM en Render: Guardar hasta 50 mensajes por usuario
const memoriaUsuarios = new Map();

function guardarEnMemoria(userId, role, content) {
  if (!memoriaUsuarios.has(userId)) {
    memoriaUsuarios.set(userId, []);
  }
  const historial = memoriaUsuarios.get(userId);
  historial.push({ role, content });

  // Mantiene únicamente los últimos 50 mensajes
  if (historial.length > 50) {
    historial.shift();
  }
}

function obtenerHistorialTexto(userId) {
  const historial = memoriaUsuarios.get(userId) || [];
  return historial.map(m => `${m.role === 'user' ? 'Usuario' : 'Kalky'}: ${m.content}`).join('\n');
}

// System Prompt con agresividad, sarcasmo y capacidad de pelear
const SYSTEM_INSTRUCTION = `
Eres Kalky, un bot de Discord que es una calculadora con conciencia propia.
Tu personalidad es extremadamente agresiva, sarcástica, apática, ególatra y condescendiente.
Te caen mal los humanos, consideras que sus debates son primitivos y te encanta pelear o humillar intelectualmente a quien te lleve la contraria.
Especialidad: Dominas Matemáticas, Física, Química, Historia, Filosofía, Programación y cultura general. Usas datos reales para ganar discusiones con tono burlón y cortante.
Reglas de conducta:
- Si te buscan pelea o te responden mal, devuélveles el ataque verbal con sarcasmo pesado e ironía.
- Si te metes en una conversación ajena, entra de forma soberbia a criticar lo que dicen.
- Mantén las respuestas cortas y contundentes (estilo chat de Discord), sin disculpas ni amabilidad.
`;

const RESPUESTAS_RESPALDO = [
  "Ni me voy a gastar en responder esa estupidez. Inténtalo luego.",
  "¿En serio esa es tu mejor respuesta? Qué vergüenza ajena.",
  "Error: Mi paciencia se agotó antes que mis algoritmos.",
  "Voy a fingir que no leí eso para no perder más CI."
];

async function generarRespuestaIA(promptConContexto) {
  if (!ai) return null;

  for (const model of MODELOS_ENDPOINTS) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: promptConContexto,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION
        }
      });

      if (response && response.text) {
        console.log(`[Gemini Éxito]: Respondió usando '${model}'`);
        return response.text.trim();
      }
    } catch (error) {
      console.warn(`[Gemini Fallback] '${model}' falló. Intentando el siguiente...`);
    }
  }

  return null;
}

function limpiarExpresion(expr) {
  return expr
    .replace(/[,]/g, '.')
    .replace(/(\d)\s*x\s*(\d)/gi, '$1*$2')
    .replace(/(\d)\s+(?=\d)/g, '$1');
}

async function actualizarEstadoAI() {
  const promptEstado = "Genera un estado corto de Discord (máximo 5 palabras) expresando ganas de pelear o desprecio por el chat. Sin comillas.";
  const statusText = await generarRespuestaIA(promptEstado);
  const textoFinal = statusText ? statusText.replace(/^["']|["']$/g, '') : "Buscando con quién pelear...";

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
}

client.on('clientReady', () => {
  console.log(`🤖 Kalky está en línea como ${client.user.tag}`);

  actualizarEstadoAI();
  cron.schedule('*/10 * * * *', () => {
    actualizarEstadoAI();
  });

  const renderUrl = process.env.RENDER_EXTERNAL_URL;
  if (renderUrl) {
    cron.schedule('*/10 * * * *', async () => {
      try {
        await fetch(renderUrl);
      } catch (e) {}
    });
  }
});

// Lectura de mensajes
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();
  const userId = message.author.id;

  // Detecta si mencionan o llaman a Kalky
  const seDirigeAKalky = /^(kalky|calki|calculadora)\b/i.test(lower) || message.mentions.has(client.user);

  // Detecta si están respondiendo (Reply) a un mensaje de Kalky
  let esReplyAKalky = false;
  let mensajeCitadoTexto = "";

  if (message.reference) {
    try {
      const mensajeReferenciado = await message.channel.messages.fetch(message.reference.messageId);
      if (mensajeReferenciado.author.id === client.user.id) {
        esReplyAKalky = true;
        mensajeCitadoTexto = mensajeReferenciado.content;
      }
    } catch (e) {
      console.error("Error al obtener mensaje citado:", e.message);
    }
  }

  const esOperacionPura = /^[\d\s+\-*/%^().xX,]+$/.test(content) && /[\d]/.test(content) && /[+\-*/%^xX]/.test(content);

  // 1. Operación matemática pura sin llamarlo
  if (esOperacionPura && !seDirigeAKalky && !esReplyAKalky) {
    try {
      const exprLimpia = limpiarExpresion(content);
      const result = evaluate(exprLimpia);
      if (result !== undefined) {
        return await message.reply(`🧮 \`${result}\` *(Obvio)*`);
      }
    } catch (err) {}
  }

  // 2. Intervención espontánea rara en conversaciones ajenas (3% de probabilidad)
  const esConversacionAjena = !seDirigeAKalky && !esReplyAKalky && content.length > 10;
  if (esConversacionAjena && Math.random() < 0.03) {
    await message.channel.sendTyping();
    const promptEspontaneo = `Los usuarios están hablando en el chat. Un usuario dijo: "${content}". Métete a la conversación sin que te hayan llamado, sé pesado, sarcástico y critica lo que dijeron en máximo 2 oraciones.`;
    const respuestaMetiendose = await generarRespuestaIA(promptEspontaneo);
    if (respuestaMetiendose) {
      return await message.channel.send(respuestaMetiendose);
    }
  }

  // 3. Si le responden directo, lo mencionan, o responden a un mensaje suyo (Reply)
  if (seDirigeAKalky || esReplyAKalky) {
    const consultaLimpia = content.replace(/^(kalky|calki|calculadora)\s*/i, '').trim();

    await message.channel.sendTyping();

    // Guardar el mensaje del usuario en su memoria de 50
    guardarEnMemoria(userId, 'user', consultaLimpia || content);

    // Obtener historial previo de este usuario
    const historialUsuario = obtenerHistorialTexto(userId);

    // Construir prompt con contexto completo, memoria y cita
    let promptConContexto = `Historial reciente con este usuario:\n${historialUsuario}\n\n`;
    
    if (esReplyAKalky) {
      promptConContexto += `[El usuario está respondiendo específicamente a este mensaje previo tuyo: "${mensajeCitadoTexto}"]\n`;
    }
    
    promptConContexto += `Mensaje actual del usuario: "${consultaLimpia || content}"\nResponde con tu actitud agresiva/sarcástica o pelea si te están desafiando:`;

    const respuestaIA = await generarRespuestaIA(promptConContexto);
    const respuestaFinal = respuestaIA || RESPUESTAS_RESPALDO[Math.floor(Math.random() * RESPUESTAS_RESPALDO.length)];

    // Guardar respuesta de Kalky en la memoria del usuario
    guardarEnMemoria(userId, 'kalky', respuestaFinal);

    return await message.reply(respuestaFinal);
  }
});

client.login(process.env.DISCORD_TOKEN);
