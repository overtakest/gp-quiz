#!/usr/bin/env node
/* =====================================================================
   ГП Тесты — бот (long polling, без зависимостей, Node 18+).
   Приветствие по /start, инлайн-кнопки открытия Mini App,
   постоянная клавиатура (Тесты / Экзамен / Профиль / О боте),
   карточка прогресса из приложения (WebApp sendData).

   Запуск:  node bot.js       (нужен bot/.env с BOT_TOKEN и WEBAPP_URL)
   ===================================================================== */
const fs = require('fs');
const path = require('path');

/* ---- .env ---- */
(() => {
  const p = path.join(__dirname, '.env');
  if (fs.existsSync(p)) for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const TOKEN = process.env.BOT_TOKEN;
const URLBASE = (process.env.WEBAPP_URL || '').replace(/\/?$/, '/');
if (!TOKEN || !URLBASE) { console.error('❌ Нужны BOT_TOKEN и WEBAPP_URL в bot/.env'); process.exit(1); }

const API = (m, b) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
}).then(r => r.json());

const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const wa = q => ({ url: URLBASE + (q || '') });   // web_app url helper

/* ---- клавиатуры ---- */
const inlineStart = () => ({
  inline_keyboard: [
    [{ text: '📚 Открыть тесты', web_app: wa() }],
    [{ text: '🎓 Экзамен', web_app: wa('?tab=exam') }, { text: '👤 Профиль', web_app: wa('?tab=profile') }],
    [{ text: 'ℹ️ О боте', callback_data: 'about' }],
  ],
});
const replyKb = {
  keyboard: [
    [{ text: '📚 Тесты', web_app: wa() }, { text: '🎓 Экзамен', web_app: wa('?tab=exam') }],
    [{ text: '👤 Профиль', web_app: wa('?sync=1') }, { text: 'ℹ️ О боте' }],
  ],
  resize_keyboard: true, is_persistent: true,
  input_field_placeholder: 'Выбери раздел или напиши /start',
};

/* ---- тексты ---- */
const welcome = name => (
`👋 <b>Привет${name ? ', ' + esc(name) : ''}!</b>

Это <b>ГП Тесты</b> — тренажёр по <b>гигиене питания</b> 🍎

📚 <b>822 вопроса</b> из реальной базы — 5 типов, вперемешку
🎓 <b>Экзамен</b>: 40 вопросов на 25 минут, как настоящий
💡 <b>Tips &amp; Tricks</b> — подсказка для запоминания после каждого ответа
📊 Прогресс, статистика и «выученные» вопросы
🎨 4 дизайна оформления + светлая/тёмная тема

Жми кнопку ниже — и погнали 👇`);

const about = (
`ℹ️ <b>О боте «ГП Тесты»</b>

Помогает готовиться к экзамену по гигиене питания:
• тренировка по всей базе (822 вопроса) с мгновенной проверкой;
• экзаменационный режим на время;
• мнемонические подсказки, чтобы лучше запоминать;
• отметка «выучено» и статистика прогресса.

Кнопки внизу открывают нужный раздел. Кнопка <b>👤 Профиль</b> присылает твою статистику прямо сюда.

Удачи на экзамене! 🎓`);

const bar = pct => { const n = Math.round(pct / 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); };

function progressCard(p) {
  const total = p.total || 822, learned = p.learned || 0;
  const pct = total ? Math.round(learned / total * 100) : 0;
  return (
`👤 <b>Твой прогресс</b>

${bar(pct)}  <b>${pct}%</b>

📚 Выучено: <b>${learned}</b> из ${total}
⏳ Осталось: <b>${total - learned}</b>
🎯 Точность ответов: <b>${p.acc != null ? p.acc + '%' : '—'}</b>
🎓 Экзаменов пройдено: <b>${p.exams || 0}</b>
🏆 Лучший балл: <b>${p.best != null ? p.best + '%' : '—'}</b>`);
}
const cardKb = () => ({
  inline_keyboard: [
    [{ text: '📚 Продолжить', web_app: wa() }, { text: '📊 Полный профиль', web_app: wa('?tab=profile') }],
  ],
});

/* ---- обработка апдейтов ---- */
async function handle(u) {
  try {
    if (u.callback_query) {
      const cq = u.callback_query;
      await API('answerCallbackQuery', { callback_query_id: cq.id });
      if (cq.data === 'about') await API('sendMessage', { chat_id: cq.message.chat.id, text: about, parse_mode: 'HTML', reply_markup: inlineStart() });
      return;
    }
    const msg = u.message;
    if (!msg) return;
    const chat = msg.chat.id;
    const name = msg.from && msg.from.first_name;

    // данные из Mini App (кнопка «Профиль» → sendData)
    if (msg.web_app_data && msg.web_app_data.data) {
      let p = {};
      try { p = JSON.parse(msg.web_app_data.data); } catch (e) {}
      if (p.t === 'progress') { await API('sendMessage', { chat_id: chat, text: progressCard(p), parse_mode: 'HTML', reply_markup: cardKb() }); return; }
    }

    const text = (msg.text || '').trim();
    if (/^\/start\b/.test(text) || /^\/help\b/.test(text)) {
      await API('sendMessage', { chat_id: chat, text: welcome(name), parse_mode: 'HTML', reply_markup: replyKb });
      await API('sendMessage', { chat_id: chat, text: 'Быстрый доступ:', reply_markup: inlineStart() });
    } else if (/о боте/i.test(text) || /^\/about\b/.test(text)) {
      await API('sendMessage', { chat_id: chat, text: about, parse_mode: 'HTML', reply_markup: replyKb });
    } else if (/^\/exam\b/.test(text)) {
      await API('sendMessage', { chat_id: chat, text: '🎓 Экзамен: 40 вопросов на 25 минут. Открывай 👇', reply_markup: { inline_keyboard: [[{ text: '🎓 Начать экзамен', web_app: wa('?tab=exam') }]] } });
    } else if (/^\/profile\b/.test(text)) {
      await API('sendMessage', { chat_id: chat, text: 'Нажми «👤 Профиль» внизу, чтобы прислать сюда свой прогресс.', reply_markup: replyKb });
    } else {
      await API('sendMessage', { chat_id: chat, text: 'Открой приложение кнопкой ниже 👇', reply_markup: replyKb });
    }
  } catch (e) { console.error('handle error:', e); }
}

/* ---- разовая настройка бота ---- */
async function setup() {
  const me = await API('getMe', {});
  if (!me.ok) { console.error('❌ Неверный BOT_TOKEN'); process.exit(1); }
  await API('setChatMenuButton', { menu_button: { type: 'web_app', text: '📚 Открыть тесты', web_app: wa() } });
  await API('setMyCommands', { commands: [
    { command: 'start', description: 'Открыть тесты по гигиене питания' },
    { command: 'exam', description: 'Экзаменационный вариант (40 вопросов, 25 мин)' },
    { command: 'profile', description: 'Мой прогресс' },
    { command: 'about', description: 'О боте' },
  ] });
  await API('setMyDescription', { description: 'Тренажёр по гигиене питания: 822 вопроса, экзамен на 25 минут, подсказки для запоминания.' });
  await API('setMyShortDescription', { short_description: '822 теста по гигиене питания + экзамен.' });
  console.log(`🤖 @${me.result.username} готов. Приветствие и клавиатура активны. Long polling запущен…`);
}

/* ---- long polling ---- */
async function poll() {
  let offset = 0;
  // сброс возможного вебхука, чтобы getUpdates работал
  await API('deleteWebhook', { drop_pending_updates: false });
  for (;;) {
    try {
      const r = await API('getUpdates', { offset, timeout: 30, allowed_updates: ['message', 'callback_query'] });
      if (r.ok && r.result.length) {
        for (const u of r.result) { offset = u.update_id + 1; handle(u); }
      }
    } catch (e) { console.error('poll error:', e.message); await new Promise(r => setTimeout(r, 3000)); }
  }
}

(async () => { await setup(); await poll(); })();
