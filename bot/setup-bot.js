#!/usr/bin/env node
/* =====================================================================
   Настройка Telegram-бота: привязывает Mini App к кнопке меню.
   Требует Node.js 18+ (встроенный fetch).

   Запуск:
     BOT_TOKEN=xxxx WEBAPP_URL=https://user.github.io/repo/ node setup-bot.js
   или заполни значения ниже / файл .env рядом.
   ===================================================================== */
const fs = require('fs');
const path = require('path');

// простой парсер .env (без зависимостей)
(() => {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
})();

const BOT_TOKEN  = process.env.BOT_TOKEN;
const WEBAPP_URL = process.env.WEBAPP_URL;
const BUTTON_TEXT = process.env.BUTTON_TEXT || '📚 Открыть тесты';

if (!BOT_TOKEN || !WEBAPP_URL) {
  console.error('❌ Укажи BOT_TOKEN и WEBAPP_URL (через переменные окружения или файл bot/.env).');
  console.error('   Пример .env:');
  console.error('     BOT_TOKEN=123456:ABC...');
  console.error('     WEBAPP_URL=https://ТВОЙ_ЛОГИН.github.io/gp-quiz/');
  process.exit(1);
}
if (!/^https:\/\//.test(WEBAPP_URL)) {
  console.error('❌ WEBAPP_URL должен начинаться с https://'); process.exit(1);
}

const api = (method, body) =>
  fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }).then(r => r.json());

(async () => {
  // 1) кто мы
  const me = await api('getMe', {});
  if (!me.ok) { console.error('❌ Неверный BOT_TOKEN:', me.description); process.exit(1); }
  console.log(`🤖 Бот: @${me.result.username}`);

  // 2) кнопка меню -> Mini App
  const btn = await api('setChatMenuButton', {
    menu_button: { type: 'web_app', text: BUTTON_TEXT, web_app: { url: WEBAPP_URL } },
  });
  console.log(btn.ok ? '✅ Кнопка меню привязана к Mini App' : '❌ Кнопка меню: ' + btn.description);

  // 3) команды бота
  const cmds = await api('setMyCommands', {
    commands: [
      { command: 'start', description: 'Открыть тесты по гигиене питания' },
      { command: 'exam',  description: 'Экзаменационный вариант (40 вопросов, 25 мин)' },
    ],
  });
  console.log(cmds.ok ? '✅ Команды установлены' : '❌ Команды: ' + cmds.description);

  // 4) описание
  await api('setMyDescription', { description: 'Тренажёр по гигиене питания: 822 вопроса, экзаменационные варианты, подсказки для запоминания.' });
  await api('setMyShortDescription', { short_description: '822 теста по гигиене питания + экзамен на 25 минут.' });

  console.log(`\n🎉 Готово! Открой @${me.result.username} в Telegram и нажми кнопку «${BUTTON_TEXT}».`);
  console.log('   Также можно добавить Mini App в BotFather → /newapp для inline-запуска.');
})().catch(e => { console.error('Ошибка:', e); process.exit(1); });
