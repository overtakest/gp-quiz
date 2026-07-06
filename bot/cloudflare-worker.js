/* =====================================================================
   ГП Тесты — бот на Cloudflare Workers (webhook, 24/7, бесплатно).

   Переменные окружения воркера (Settings → Variables):
     BOT_TOKEN      — токен из @BotFather
     WEBAPP_URL     — https://overtakest.github.io/gp-quiz/
     WEBHOOK_SECRET — любая случайная строка (необязательно, для защиты)

   После деплоя открой в браузере:  https://<твой-воркер>.workers.dev/setWebhook
   один раз — это привяжет Telegram к воркеру. Готово.
   ===================================================================== */

export default {
  async fetch(request, env) {
    const token = env.BOT_TOKEN;
    const base = (env.WEBAPP_URL || '').replace(/\/?$/, '/');
    const secret = env.WEBHOOK_SECRET || '';
    if (!token || !base) return new Response('Set BOT_TOKEN and WEBAPP_URL vars', { status: 500 });

    const api = (m, b) => fetch(`https://api.telegram.org/bot${token}/${m}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b || {}),
    }).then(r => r.json());

    const url = new URL(request.url);

    // ---- одноразовая привязка вебхука ----
    if (url.pathname === '/setWebhook') {
      const hook = `${url.origin}/`;
      const r = await api('setWebhook', {
        url: hook, allowed_updates: ['message', 'callback_query'],
        ...(secret ? { secret_token: secret } : {}),
      });
      await api('setChatMenuButton', { menu_button: { type: 'web_app', text: '📚 Открыть тесты', web_app: { url: base } } });
      await api('setMyCommands', { commands: [
        { command: 'start', description: 'Открыть тесты по гигиене питания' },
        { command: 'exam', description: 'Экзаменационный вариант (40 вопросов, 25 мин)' },
        { command: 'profile', description: 'Мой прогресс' },
        { command: 'about', description: 'О боте' },
      ] });
      return new Response('Webhook -> ' + hook + '\n' + JSON.stringify(r), { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }

    if (request.method !== 'POST') {
      return new Response('ГП Тесты bot is running. Open /setWebhook once to activate.', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    }
    if (secret && request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== secret) {
      return new Response('forbidden', { status: 403 });
    }

    let update; try { update = await request.json(); } catch (e) { return new Response('ok'); }

    // ---- вспомогательное ----
    const esc = s => String(s == null ? '' : s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const wa = q => ({ url: base + (q || '') });
    const inlineStart = () => ({ inline_keyboard: [
      [{ text: '📚 Открыть тесты', web_app: wa() }],
      [{ text: '🎓 Экзамен', web_app: wa('?tab=exam') }, { text: '👤 Профиль', web_app: wa('?tab=profile') }],
      [{ text: 'ℹ️ О боте', callback_data: 'about' }],
    ] });
    const replyKb = {
      keyboard: [
        [{ text: '📚 Тесты', web_app: wa() }, { text: '🎓 Экзамен', web_app: wa('?tab=exam') }],
        [{ text: '👤 Профиль', web_app: wa('?sync=1') }, { text: 'ℹ️ О боте' }],
      ], resize_keyboard: true, is_persistent: true, input_field_placeholder: 'Выбери раздел или напиши /start',
    };
    const welcome = name => `👋 <b>Привет${name ? ', ' + esc(name) : ''}!</b>\n\nЭто <b>ГП Тесты</b> — тренажёр по <b>гигиене питания</b> 🍎\n\n📚 <b>822 вопроса</b> из реальной базы — 5 типов, вперемешку\n🎓 <b>Экзамен</b>: 40 вопросов на 25 минут, как настоящий\n💡 <b>Tips &amp; Tricks</b> — подсказка для запоминания после каждого ответа\n📊 Прогресс, статистика и «выученные» вопросы\n🎨 4 дизайна оформления + светлая/тёмная тема\n\nЖми кнопку ниже — и погнали 👇`;
    const about = `ℹ️ <b>О боте «ГП Тесты»</b>\n\nПомогает готовиться к экзамену по гигиене питания:\n• тренировка по всей базе (822 вопроса) с мгновенной проверкой;\n• экзаменационный режим на время;\n• мнемонические подсказки, чтобы лучше запоминать;\n• отметка «выучено» и статистика прогресса.\n\nКнопки внизу открывают нужный раздел. Кнопка <b>👤 Профиль</b> присылает твою статистику прямо сюда.\n\nУдачи на экзамене! 🎓`;
    const bar = pct => { const n = Math.round(pct / 10); return '▰'.repeat(n) + '▱'.repeat(10 - n); };
    const card = p => { const total = p.total || 822, learned = p.learned || 0, pct = total ? Math.round(learned / total * 100) : 0;
      return `👤 <b>Твой прогресс</b>\n\n${bar(pct)}  <b>${pct}%</b>\n\n📚 Выучено: <b>${learned}</b> из ${total}\n⏳ Осталось: <b>${total - learned}</b>\n🎯 Точность ответов: <b>${p.acc != null ? p.acc + '%' : '—'}</b>\n🎓 Экзаменов пройдено: <b>${p.exams || 0}</b>\n🏆 Лучший балл: <b>${p.best != null ? p.best + '%' : '—'}</b>`; };
    const cardKb = () => ({ inline_keyboard: [[{ text: '📚 Продолжить', web_app: wa() }, { text: '📊 Полный профиль', web_app: wa('?tab=profile') }]] });

    try {
      if (update.callback_query) {
        const cq = update.callback_query;
        await api('answerCallbackQuery', { callback_query_id: cq.id });
        if (cq.data === 'about') await api('sendMessage', { chat_id: cq.message.chat.id, text: about, parse_mode: 'HTML', reply_markup: inlineStart() });
        return new Response('ok');
      }
      const msg = update.message;
      if (msg) {
        const chat = msg.chat.id;
        const name = msg.from && msg.from.first_name;
        if (msg.web_app_data && msg.web_app_data.data) {
          let p = {}; try { p = JSON.parse(msg.web_app_data.data); } catch (e) {}
          if (p.t === 'progress') { await api('sendMessage', { chat_id: chat, text: card(p), parse_mode: 'HTML', reply_markup: cardKb() }); return new Response('ok'); }
        }
        const text = (msg.text || '').trim();
        if (/^\/start\b/.test(text) || /^\/help\b/.test(text)) {
          await api('sendMessage', { chat_id: chat, text: welcome(name), parse_mode: 'HTML', reply_markup: replyKb });
          await api('sendMessage', { chat_id: chat, text: 'Быстрый доступ:', reply_markup: inlineStart() });
        } else if (/о боте/i.test(text) || /^\/about\b/.test(text)) {
          await api('sendMessage', { chat_id: chat, text: about, parse_mode: 'HTML', reply_markup: replyKb });
        } else if (/^\/exam\b/.test(text)) {
          await api('sendMessage', { chat_id: chat, text: '🎓 Экзамен: 40 вопросов на 25 минут. Открывай 👇', reply_markup: { inline_keyboard: [[{ text: '🎓 Начать экзамен', web_app: wa('?tab=exam') }]] } });
        } else if (/^\/profile\b/.test(text)) {
          await api('sendMessage', { chat_id: chat, text: 'Нажми «👤 Профиль» внизу, чтобы прислать сюда свой прогресс.', reply_markup: replyKb });
        } else {
          await api('sendMessage', { chat_id: chat, text: 'Открой приложение кнопкой ниже 👇', reply_markup: replyKb });
        }
      }
    } catch (e) { /* не роняем вебхук */ }
    return new Response('ok');
  },
};
