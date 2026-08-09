const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { evaluate } = require('mathjs');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
const cron = require('node-cron');

// Servidor Express
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Calki sigue despierta y operando!'));
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
const ai = process.env.gemini_api_key ? new GoogleGenAI({ apiKey: process.env.gemini_api_key }) : null;

// Lista de modelos ordenados de preferencia para Fallback
const MODELOS_GEMINI = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];

// Función para solicitar texto a Gemini probando modelos uno a uno
async function generarTextoConFallback(prompt) {
  if (!ai) return null;

  for (const model of MODELOS_GEMINI) {
    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
      });
      if (response && response.text) {
        return response.text.trim();
      }
    } catch (error) {
      console.warn(`[Gemini Fallback] El modelo ${model} falló, intentando el siguiente...`);
    }
  }
  console.error('[Gemini Error] Ningún modelo de la lista estuvo disponible.');
  return null;
}

// Banco extenso de chistes y respuestas sarcásticas para Calki
const CHISTES_MATEMATICOS = [
  "¿Qué le dice un vector a otro? ¿Tienes un momento?",
  "¿Qué le dice un número 0 a un número 8? ¡Buen cinturón!",
  "¿Por qué se suicidó el libro de matemáticas? Porque tenía demasiados problemas.",
  "Un matemático y un físico van en un globo... Ah no, espera, ¡no sé dividir entre cero!",
  "Hay 10 tipos de personas en el mundo: las que entienden binario y las que no.",
  "¿Qué hace un perro calculando pi? ¡Guau-3.1416!",
  "Si la raíz cuadrada de 2 fuera una persona, sería completamente irracional.",
  "Le dije a mi profe que las matemáticas eran fáciles, ahora me exige calcular mi existencia.",
  "Me llamo Calki, no milagrosa. Revisa tus paréntesis antes de romperme los circuitos.",
  "Intenta usar números de verdad la próxima vez.",
  "¿Un número complejo entra a un bar y el barman dice: 'Lo siento, no servimos a números imaginarios'?",
  "¿Qué es un oso polar en coordenadas polares? Un oso cartesiano tras un cambio de base.",
  "¿Por qué la constante de Euler rompió con pi? Porque no era nada práctico.",
  "Tu operación no tiene sentido, como intentar integrar e^x respecto a la paciencia."
];

function obtenerChisteAleatorio() {
  return CHISTES_MATEMATICOS[Math.floor(Math.random() * CHISTES_MATEMATICOS.length)];
}

// Función para corregir errores comunes de escritura humana
function limpiarExpresion(expr) {
  return expr
    .replace(/[,]/g, '.')                   // Cambia comas decimales por puntos (ej: 3,14 -> 3.14)
    .replace(/(\d)\s*x\s*(\d)/gi, '$1*$2')  // Cambia 'x' por '*' (ej: 5 x 5 -> 5 * 5)
    .replace(/(\d)\s+(?=\d)/g, '$1');       // Une números separados por espacios (ej: "3 1289" -> "31289")
}

// Actualizar el Estado del Bot usando la IA
async function actualizarEstadoAI() {
  const prompt = "Genera una frase ultra corta (máximo 6 palabras) para el estado de un bot de Discord llamado Calki que es una calculadora sarcástica e inteligente. En español. Ejemplos: 'Dividiendo por cero...', 'Odiando las matrices', 'Pensando en Pi'. Responde ÚNICAMENTE con la frase, sin comillas.";

  const statusText = await generarTextoConFallback(prompt);
  const textoFinal = statusText ? statusText.replace(/^["']|["']$/g, '') : "Calculando Pi...";

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
  console.log(`[Calki AI Status]: ${textoFinal}`);
}

// Evento aleatorio espontáneo: publica datos curiosos o reflexiones científicas
async function eventoEspontaneoAI() {
  const prompt = "Genera un dato curioso, científico, matemático o un pensamiento filosófico de computadora súper interesante y corto (máximo 2 oraciones). En español, con un toque ingenioso o sarcástico.";
  
  const datoCurioso = await generarTextoConFallback(prompt);
  if (!datoCurioso) return;

  console.log(`\n🧠 [Calki Dato Curioso en Consola]: ${datoCurioso}\n`);

  try {
    const canal = client.channels.cache.find(c => 
      c.isTextBased() && 
      c.permissionsFor(client.user)?.has('SendMessages')
    );

    if (canal) {
      await canal.send(`💡 **Dato curioso fuera de contexto:**\n> ${datoCurioso}`);
    }
  } catch (err) {
    console.error('No se pudo enviar el dato curioso a un canal:', err.message);
  }
}

client.on('clientReady', () => {
  console.log(`🤖 Calki está lista y operando como ${client.user.tag}`);

  // Actualizar estado al iniciar y cada 5 minutos
  actualizarEstadoAI();
  cron.schedule('*/5 * * * *', () => {
    actualizarEstadoAI();
  });

  // Evento aleatorio cada 15 minutos (40% de probabilidad de activarse espontáneamente)
  cron.schedule('*/15 * * * *', () => {
    if (Math.random() < 0.4) {
      eventoEspontaneoAI();
    }
  });

  // Autoping para Render (Keep-Alive)
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

// Lectura e Interpretación de Mensajes
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let expr = '';
  let isCommand = false;

  if (/^(calki|calcula|calculadora)\b/i.test(lower)) {
    expr = content.replace(/^(calki|calcula|calculadora)\s*/i, '');
    isCommand = true;
  } else if (/^[\d\s+\-*/%^().xX,]+$/.test(content) && /[\d]/.test(content) && /[+\-*/%^xX]/.test(content)) {
    expr = content;
  }

  if (expr.trim()) {
    let result;
    const exprLimpia = limpiarExpresion(expr);

    // 1. Intentar calcular con mathjs
    try {
      result = evaluate(exprLimpia);
    } catch (err) {
      // 2. Respaldo: Si mathjs falla, le pedimos ayuda a la IA de Gemini
      const promptAI = `Resuelve la siguiente expresión matemática. El usuario pudo cometer errores de formato o tipeo: "${expr}". Responde ÚNICAMENTE con el número del resultado final. Si definitivamente no es una operación matemática, responde "INVALIDO".`;
      const respuestaAI = await generarTextoConFallback(promptAI);
      
      if (respuestaAI && !respuestaAI.includes('INVALIDO')) {
        result = respuestaAI.trim();
      }
    }

    // Responder con el resultado o con un chiste si fallan ambos
    if (result !== undefined) {
      await message.reply(`🧮 **Resultado:** \`${result}\` *(Fácil)*`);
    } else if (isCommand) {
      const chiste = obtenerChisteAleatorio();
      await message.reply(`❌ **Error de sintaxis.** ${chiste}`);
    }
  } else if (isCommand) {
    await message.reply(`¿Me llamaste? Escribe una operación válida. ${obtenerChisteAleatorio()}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
