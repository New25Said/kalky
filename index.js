const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const { evaluate } = require('mathjs');
const { GoogleGenAI } = require('@google/genai');
const express = require('express');
const cron = require('node-cron');

// Servidor Express
const app = express();
const PORT = process.env.PORT || 3000;
app.get('/', (req, res) => res.send('Calki sigue despierta y operando!'));
const server = app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));

// Cliente de Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Inicializar API de Gemini con la variable especificada
const ai = process.env.gemini_api_key ? new GoogleGenAI({ apiKey: process.env.gemini_api_key }) : null;

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

// Generador de Estado vía Gemini
async function actualizarEstadoAI() {
  if (!ai) return;

  const prompt = "Genera una frase ultra corta (máximo 6 palabras) para el estado de estado de un bot de Discord llamado Calki que es una calculadora sarcástica e inteligente. En español. Ejemplos: 'Dividiendo por cero...', 'Odiando las matrices', 'Pensando en Pi'. Solo responde con la frase.";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents: prompt,
    });

    const statusText = response.text ? response.text.trim().replace(/^["']|["']$/g, '') : "Calculando Pi...";

    const actividades = [
      ActivityType.Playing,
      ActivityType.Watching,
      ActivityType.Listening,
      ActivityType.Competing
    ];
    const tipoAleatorio = actividades[Math.floor(Math.random() * actividades.length)];

    client.user.setPresence({
      activities: [{ name: statusText, type: tipoAleatorio }],
      status: 'online',
    });
    console.log(`[Calki AI Status]: ${statusText}`);
  } catch (error) {
    console.error("Error al obtener estado con Gemini:", error.message);
  }
}

client.on('ready', () => {
  console.log(`🤖 Calki está lista y operando como ${client.user.tag}`);

  // Actualizar estado al iniciar y luego cada 5 minutos
  actualizarEstadoAI();
  cron.schedule('*/5 * * * *', () => {
    actualizarEstadoAI();
  });

  // Sistema Keep-Alive para Render (Autoping cada 10 minutos)
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

// Lectura de Mensajes
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let expr = '';
  let isCommand = false;

  if (/^(calki|calcula|calculadora)\b/i.test(lower)) {
    expr = content.replace(/^(calki|calcula|calculadora)\s*/i, '');
    isCommand = true;
  } else if (/^[\d\s+\-*/%^().]+$/.test(content) && /[\d]/.test(content) && /[+\-*/%^]/.test(content)) {
    expr = content;
  }

  if (expr.trim()) {
    try {
      const result = evaluate(expr);
      if (result !== undefined) {
        await message.reply(`🧮 **Resultado:** \`${result}\` *(Fácil)*`);
      }
    } catch (err) {
      if (isCommand) {
        const chiste = obtenerChisteAleatorio();
        await message.reply(`❌ **Error de sintaxis.** ${chiste}`);
      }
    }
  } else if (isCommand) {
    await message.reply(`¿Me llamaste? Escribe una operación válida. ${obtenerChisteAleatorio()}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
