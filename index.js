const { Client, GatewayIntentBits } = require('discord.js');
const { evaluate } = require('mathjs');
const express = require('express');

// Servidor web para mantener a Render activo
const app = express();
app.get('/', (req, res) => res.send('Calki está funcionando!'));
app.listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.on('ready', () => {
  console.log(`Calki está en línea como ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lower = content.toLowerCase();

  let expr = '';
  let isCommand = false;

  // 1. Detecta si empieza con prefijo de palabra clave
  if (/^(calki|calcula|calculadora)\b/i.test(lower)) {
    expr = content.replace(/^(calki|calcula|calculadora)\s*/i, '');
    isCommand = true;
  } 
  // 2. Detecta si es una operación directa (ej: "2 + 2" o " (5 * 10) / 2 ")
  else if (/^[\d\s+\-*/%^().]+$/.test(content) && /[\d]/.test(content) && /[+\-*/%^]/.test(content)) {
    expr = content;
  }

  if (expr.trim()) {
    try {
      const result = evaluate(expr);
      if (result !== undefined) {
        await message.reply(`🧮 **Resultado:** \`${result}\``);
      }
    } catch (err) {
      if (isCommand) {
        await message.reply('❌ No pude calcular eso. Revisa la expresión matemática.');
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
