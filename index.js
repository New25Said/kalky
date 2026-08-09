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

// Modelos estables de Gemini
const MODELOS_GEMINI = [
  'gemini-2.5-flash',
  'gemini-1.5-flash'
];

// Control de cuota (cooldown)
let apiBloqueadaHasta = 0;

// Estados aleatorios de respaldo
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

async function generarTextoConFallback(prompt) {
  if (!ai) return null;

  // Si la API está en tiempo de espera por cuota, se omite la llamada
  if (Date.now() < apiBloqueadaHasta) {
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
      if (error.message.includes('429') || error.message.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Gemini Quota] Cuota excedida en ${model}. Pausando peticiones a la IA por 15 min.`);
        apiBloqueadaHasta = Date.now() + 15 * 60 * 1000; // Bloquea llamadas a la API por 15 minutos
        break;
      } else {
        console.warn(`[Gemini Fallback] ${model} no respondió.`);
      }
    }
  }
  return null;
}

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

async function actualizarEstadoAI() {
  const prompt = "Genera una frase corta (máximo 5 palabras) para el estado de Discord de una calculadora sarcástica llamada Calki. En español, sin comillas.";

  const statusText = await generarTextoConFallback(prompt);
  
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
  console.log(`[Calki Status]: ${textoFinal}`);
}

async function eventoEspontaneoAI() {
  const prompt = "Genera un dato curioso, científico o matemático muy corto (máximo 2 oraciones). En español, ingenioso.";
  
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

  // Actualizar estado al conectar y luego cada 10 minutos
  actualizarEstadoAI();
  cron.schedule('*/10 * * * *', () => {
    actualizarEstadoAI();
  });

  // Evento aleatorio cada 20 minutos (30% probabilidad)
  cron.schedule('*/20 * * * *', () => {
    if (Math.random() < 0.3) {
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
      const promptAI = `Resuelve esta operación matemática: "${expr}". Responde ÚNICAMENTE con el número final. Si no es válida, responde "INVALIDO".`;
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
