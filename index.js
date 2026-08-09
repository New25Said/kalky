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
const apiKey = process.env.gemini_api_key;
const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Modelos de Gemini probados en orden
const MODELOS_GEMINI = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-2.0-flash'
];

// Estados aleatorios de respaldo si la IA falla o se agota la cuota
const ESTADOS_RESPALDO = [
  "Dividiendo por cero...",
  "Odiando las matrices...",
  "Pensando en Pi...",
  "Buscando la x...",
  "Procesando derivadas...",
  "Simulando conciencia...",
  "Juzgando tu sintaxis...",
  "Optimizando algoritmos...",
  "Resolviendo integrales...",
  "Contando en binario...",
  "E = mc² (creo)...",
  "Reiniciando neuronas...",
  "Analizando variables...",
  "Calculando el infinito...",
  "Evitando errores 404..."
];

// Función con fallback y logs detallados de error
async function generarTextoConFallback(prompt) {
  if (!ai) {
    console.warn('[Gemini Warning] No se detectó la variable gemini_api_key en Render.');
    return null;
  }

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
      console.warn(`[Gemini Fallback] ${model} falló. Motivo: ${error.message}`);
    }
  }
  console.error('[Gemini Error] Ningún modelo respondió correctamente.');
  return null;
}

// Banco de chistes matemáticos
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

function limpiarExpresion(expr) {
  return expr
    .replace(/[,]/g, '.')
    .replace(/(\d)\s*x\s*(\d)/gi, '$1*$2')
    .replace(/(\d)\s+(?=\d)/g, '$1');
}

// Cambia el estado usando la IA (o respaldo dinámico)
async function actualizarEstadoAI() {
  const prompt = "Genera una frase ultra corta (máximo 5 palabras) para el estado de Discord de un bot calculadora llamado Calki. En español. Ejemplos: 'Odiando las matrices', 'Pensando en Pi', 'Calculando el fin del mundo'. Responde SOLO la frase, sin comillas.";

  const statusText = await generarTextoConFallback(prompt);
  
  // Si la IA responde se usa su texto; si falla, elige uno al azar de la lista de respaldo
  const textoFinal = statusText 
    ? statusText.replace(/^["']|["']$/g, '') 
    : ESTADOS_RESPALDO[Math.floor(Math.random() * ESTADOS_RESPALDO.length)];

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

// Evento espontáneo aleatorio
async function eventoEspontaneoAI() {
  const prompt = "Genera un dato curioso, científico o matemático muy corto (máximo 2 oraciones). En español, ingenioso y divertido.";
  
  const datoCurioso = await generarTextoConFallback(prompt);
  if (!datoCurioso) return;

  console.log(`\n🧠 [Calki Dato Curioso]: ${datoCurioso}\n`);

  try {
    const canal = client.channels.cache.find(c => 
      c.isTextBased() && 
      c.permissionsFor(client.user)?.has('SendMessages')
    );

    if (canal) {
      await canal.send(`💡 **Dato curioso fuera de contexto:**\n> ${datoCurioso}`);
    }
  } catch (err) {
    console.error('No se pudo enviar el dato curioso:', err.message);
  }
}

client.on('clientReady', () => {
  console.log(`🤖 Calki está lista y operando como ${client.user.tag}`);

  // Actualizar estado al conectar y luego CADA 2 MINUTOS (máxima velocidad segura)
  actualizarEstadoAI();
  cron.schedule('*/2 * * * *', () => {
    actualizarEstadoAI();
  });

  // Evento aleatorio cada 15 minutos (40% probabilidad)
  cron.schedule('*/15 * * * *', () => {
    if (Math.random() < 0.4) {
      eventoEspontaneoAI();
    }
  });

  // Keep-Alive para Render
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

    try {
      result = evaluate(exprLimpia);
    } catch (err) {
      const promptAI = `Resuelve esta operación matemática: "${expr}". Responde ÚNICAMENTE con el número final del resultado. Si no es una operación válida, responde "INVALIDO".`;
      const respuestaAI = await generarTextoConFallback(promptAI);
      
      if (respuestaAI && !respuestaAI.includes('INVALIDO')) {
        result = respuestaAI.trim();
      }
    }

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
