// index.js
const { Telegraf, Markup, Scenes, session } = require('telegraf');
const axios = require('axios');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// --- CONFIG ---
const BOT_TOKEN = '8034760491:AAEIqcV0xvX6ugpHr05-bVZY6bUM-aGNfjg';
const API_KEY = 'SG_b5f8f712e9924783';
const API_ENDPOINT = 'https://api.segmind.com/v1/sd2.1-faceswapper';
const COOLDOWN_SECONDS = 120;

const userLastTime = {};
const userImages = {};

const bot = new Telegraf(BOT_TOKEN);

// --- SCENES ---
const getFaceScene = new Scenes.BaseScene('GET_FACE');
const getTargetScene = new Scenes.BaseScene('GET_TARGET');

// Util: Image URL to Base64
const imgUrlToBase64 = async (url) => {
  const response = await fetch(url);
  const buffer = await response.buffer();
  return buffer.toString('base64');
};

// Start command
bot.start((ctx) => {
  ctx.reply(
    '**👾Welcome to Face Swapper Bot!**\nSend two images and get a swapped face output💮.',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.callback('☂️SWAP FACE☂️', 'swap')],
        [Markup.button.url('☂️DEVELOPER☂️', 'https://t.me/+cc6Lt64HKXtmYmNl')]
      ])
    }
  );
});

// Scene: GET_FACE
getFaceScene.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const photo = ctx.message.photo.pop(); // highest quality
  const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
  userImages[userId] = { face: fileUrl.href };

  await ctx.reply('☂️NOW SEND THE TARGET IMAGE.☂️');
  ctx.scene.enter('GET_TARGET');
});

getFaceScene.on('message', (ctx) => ctx.reply('🙄PLEASE SEND AN IMAGE.🔥'));

// Scene: GET_TARGET
getTargetScene.on('photo', async (ctx) => {
  const userId = ctx.from.id;
  const now = new Date();

  if (userLastTime[userId]) {
    const diff = (now - userLastTime[userId]) / 1000;
    if (diff < COOLDOWN_SECONDS) {
      const wait = Math.ceil(COOLDOWN_SECONDS - diff);
      await ctx.reply(`☂️Please wait ${wait} seconds before using this again.☂️`);
      return ctx.scene.leave();
    }
  }

  userLastTime[userId] = now;
  const photo = ctx.message.photo.pop();
  const fileUrl = await ctx.telegram.getFileLink(photo.file_id);
  userImages[userId].target = fileUrl.href;

  const faceB64 = await imgUrlToBase64(userImages[userId].face);
  const targetB64 = await imgUrlToBase64(userImages[userId].target);

  const payload = {
    input_face_image: faceB64,
    target_face_image: targetB64,
    file_type: 'png',
    face_restore: true
  };

  const headers = {
    'x-api-key': API_KEY,
    'Content-Type': 'application/json'
  };

  await ctx.reply('💮PROCESSING IMAGE... PLEASE WAIT.⚡');

  try {
    const res = await axios.post(API_ENDPOINT, payload, {
      headers,
      responseType: 'arraybuffer'
    });

    const outputPath = path.join(__dirname, `output_${userId}.png`);
    fs.writeFileSync(outputPath, res.data);
    await ctx.replyWithPhoto({ source: outputPath });
    fs.unlinkSync(outputPath);
  } catch (err) {
    console.error(err);
    await ctx.reply('Failed to process image.');
  }

  ctx.scene.leave();
});

getTargetScene.on('message', (ctx) => ctx.reply('☂️PLEASE SEND AN IMAGE.☂️'));

// Swap button
bot.action('swap', async (ctx) => {
  await ctx.reply('⚡PLEASE SEND THE FACE IMAGE.🛑');
  ctx.scene.enter('GET_FACE');
});

// Cancel command (if needed)
bot.command('cancel', (ctx) => {
  ctx.reply('Cancelled.');
  ctx.scene.leave();
});

// Setup scenes
const stage = new Scenes.Stage([getFaceScene, getTargetScene]);
bot.use(session());
bot.use(stage.middleware());

// Start polling
bot.launch();
console.log('Bot running...');
