/**
 * AbikusGPT — Cloudflare Worker (final single-file)
 * Version: B_5.6.1
 *
 * - Full bot logic (commands, inline keyboards)
 * - /addbot flow (accept token:..., setWebhook -> getWebhookInfo -> getMe)
 * - HF Router model calls
 * - Long responses (>4096) -> response.txt via sendDocument
 * - Markdown fallback
 * - All config / tokens in-code (you asked)
 *
 * WARNING: Tokens are embedded in code. Deploy where you are comfortable.
 */

/* ================== CONFIG ================== */
const TELEGRAM_TOKEN = "8391467750:AAEyhpR-OAhO32j8F8wii0fwTQc6kNNCxtc"; // main bot token
const HF_TOKEN = "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"; // HF token

const HF_URL = "https://router.huggingface.co/v1/chat/completions";
const TELEGRAM_API = (token) => `https://api.telegram.org/bot${token}`;
const TELEGRAM_FILE_API = (token) => `https://api.telegram.org/bot${token}/sendDocument`;

const BOT_NAME = "AbikusGPT";
const OWNER_USERNAME = "AbikusSudo"; // owner (two s) - used for owner-only commands
const WEBHOOK_BASE = "https://abikusgpt.abikussudo.workers.dev"; // ensure double 's'
const WEBHOOK_PATH = "/webhook/tg";
const ADD_BOT_WEBHOOK_PATH = "/webhook/tg/addbot"; // webhook path for added bots

const DEFAULT_MODEL = "deepseek-ai/DeepSeek-V3:novita";
const DEFAULT_TEMP = 0.7;

/* Exact model map requested */
const MODEL_MAP = {
  "AbikusGPT-oss120": "openai/gpt-oss-120b:groq",
  "AbikusGPT-oss20": "openai/gpt-oss-20b:groq",
  "AbikusGPT-DSv3": "deepseek-ai/DeepSeek-V3:novita"
};

/* ================== UI / TEXTS ================== */
const Emoji = {
  LANGUAGES: { ru: "🇷🇺 Русский", en: "🇬🇧 English" },
  LOADING: ["⏳", "🔄", "💭", "🧠", "⚙️", "🔍", "📡", "🚀", "🌈", "✨"],
  SUCCESS: "✅", ERROR: "❌", WARNING: "⚠️", ROBOT: "🤖", HEART: "❤️",
  HEADER: "✨".repeat(14),
  FOOTER: "▁▂▃▄▅▆▇█▓▒░▒▓█▇▆▅▄▃▂▁",
  DIVIDER: "•⋅☆⋅•⋅☆⋅•⋅☆⋅•⋅☆⋅•⋅☆⋅•"
};

const Translations = {
  TEXTS: {
    welcome: {
      ru: `${Emoji.HEADER}
${Emoji.ROBOT} <b>Добро пожаловать в AbikusGPT!</b> ${Emoji.ROBOT}
${Emoji.HEADER}

🌟 Я - нейросеть, созданная AbikusSudo (@AbikusSudo).   
💡 Я знаю всё на свете и готова помочь вам!
🌈 Будем творить чудеса вместе!
🌐 I have my own website! >> ${WEBHOOK_BASE}
🚫 2025 TM AbikusSudo. Чекните мой GitHub: https://github.com/AbikusSudo!`,
      en: `${Emoji.HEADER}
${Emoji.ROBOT} <b>Welcome to AbikusGPT!</b> ${Emoji.ROBOT}
${Emoji.HEADER}

🌟 I'm an AI created by AbikusSudo (@AbikusSudo).   
💡 I know everything and I'm here to help you!
🌈 Let's create magic together!
🌐 I have my own website! >> ${WEBHOOK_BASE}
🚫 2025 TM AbikusSudo. Check out my GitHub: https://github.com/AbikusSudo!`
    },
    select_language: { ru: "🌍 <b>Выберите язык интерфейса:</b>", en: "🌍 <b>Select interface language:</b>" },
    language_set: {
      ru: `${Emoji.SUCCESS} <b>Язык установлен!</b>\nТеперь я говорю по-русски 🇷🇺 ${Emoji.HEART}`,
      en: `${Emoji.SUCCESS} <b>Language set!</b>\nNow I speak English 🇬🇧 ${Emoji.HEART}`
    },
    processing: {
      ru: [
        "🧠 Обрабатываю ваш запрос...",
        "🔍 Анализирую информацию...",
        "⚙️ Оптимизирую алгоритмы...",
        "🌐 Синхронизируюсь с серверами...",
        "📡 Устанавливаю соединение...",
        "📚 Ищу в базе знаний...",
        "💡 Генерирую ответ...",
        "🚀 Завершаю обработку..."
      ],
      en: [
        "🧠 Processing your request...",
        "🔍 Analyzing information...",
        "⚙️ Optimizing algorithms...",
        "🌐 Synchronizing with servers...",
        "📡 Establishing connection...",
        "📚 Searching knowledge base...",
        "💡 Generating response...",
        "🚀 Finalizing output..."
      ]
    },
    ai_response: { ru: `${Emoji.ROBOT} <b>✨ Ответ AbikusGPT ✨</b> ${Emoji.ROBOT}`, en: `${Emoji.ROBOT} <b>✨ AbikusGPT Response ✨</b> ${Emoji.ROBOT}` },
    connection_error: {
      ru: `${Emoji.ERROR} <b>Ошибка соединения!</b>\n\n⚡ Не удалось подключиться к серверу\n🔧 Пожалуйста, попробуйте позже`,
      en: `${Emoji.ERROR} <b>Connection error!</b>\n\n⚡ Failed to connect to server\n🔧 Please try again later`
    },
    features: {
      ru: `\n🎯✨ <b>Возможности AbikusGPT:</b>\n\n❓ Нужна помощь? Напишите /help.\n\n• 📝 Генерация текстов\n• 📊 Анализ данных\n• 🖼️ Создание описаний\n• 🔍 Решение задач\n• 🗣️ Поддержка языков\n• 🧠 Глубокая экспертиза\n• ✨ Креативный подход\n`,
      en: `\n🎯✨ <b>AbikusGPT Features:</b>\n\n❓ Need help? Type /help.\n\n• 📝 Text generation\n• 📊 Data analysis\n• 🖼️ Image descriptions\n• 🔍 Problem solving\n• 🗣️ Multilingual\n• 🧠 Deep expertise\n• ✨ Creative approach\n`
    },
    about: {
      ru: `${Emoji.ROBOT} <b>✨ О AbikusGPT ✨</b> ${Emoji.ROBOT}\n\n🛠️ Версия: B_5.6.1\n👨‍💻 Создатель: AbikusSudo (@AbikusSudo)\n\n🌟 Я - нейросеть, которая знает всё на свете!\n💡 Моя цель - помогать вам с любыми вопросами.\n🌈 Давайте создавать что-то удивительное вместе!\n\n${Emoji.DIVIDER}`,
      en: `${Emoji.ROBOT} <b>✨ About AbikusGPT ✨</b> ${Emoji.ROBOT}\n\n🛠️ Version: B_5.6.1\n👨‍💻 Creator: AbikusSudo (@AbikusSudo)\n\n🌟 I'm an AI that knows everything!\n💡 My purpose is to help you with any questions.\n🌈 Let's create something amazing together!\n\n${Emoji.DIVIDER}`
    },
    help: {
      ru: `${Emoji.ROBOT} <b>✨ Список команд ✨</b> ${Emoji.ROBOT}\n\n📌 <b>Основные команды:</b>\n/start - Начать работу\n/help - Помощь по командам\n/about - Информация о боте\n/model - Выбрать модель ИИ\n/language - Изменить язык\n\n⚙️ <b>Для владельца:</b>\n/stop - Остановить бота\n/clear - Очистить диалог\n/allow - Разрешить/запретить запросы\n/addbot - Создать копию (не оригинал)\n\n${Emoji.DIVIDER}`,
      en: `${Emoji.ROBOT} <b>✨ Commands List ✨</b> ${Emoji.ROBOT}\n\n📌 <b>Main commands:</b>\n/start - Start the bot\n/help - Show help\n/about - Bot information\n/model - Select AI model\n/language - Change language\n\n⚙️ <b>For owner:</b>\n/stop - Stop the bot\n/clear - Clear chat\n/allow - Enable/disable requests\n/addbot - Create clone (not original)\n\n${Emoji.DIVIDER}`
    }
  },
  get_text(key, language = "ru") {
    if (key === "processing") {
      const arr = this.TEXTS[key][language] || this.TEXTS[key].ru;
      return arr[Math.floor(Math.random() * arr.length)];
    }
    return this.TEXTS[key]?.[language] ?? key;
  }
};

/* ================== In-memory stores ================== */
/* userStore structure:
   chat_id -> {
     language, model, temp, allow_requests,
     waiting_for_addbot_token: boolean
   }
*/
const userStore = new Map();
const recentUpdates = new Set();
const MAX_RECENT = 400;

/* ================== Telegram helpers ================== */
async function tgFetch(token, method, payload) {
  const url = `${TELEGRAM_API(token)}/${method}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  try { return await res.json(); } catch (e) { return { ok: false, error: String(e) }; }
}

async function sendMessage(token, chat_id, text, options = {}) {
  return await tgFetch(token, "sendMessage", { chat_id, text, ...options });
}

async function editMessageText(token, chat_id, message_id, text, options = {}) {
  return await tgFetch(token, "editMessageText", { chat_id, message_id, text, ...options });
}

async function deleteMessage(token, chat_id, message_id) {
  return await tgFetch(token, "deleteMessage", { chat_id, message_id });
}

async function answerCallbackQuery(token, callback_query_id, text = "") {
  return await tgFetch(token, "answerCallbackQuery", { callback_query_id, text });
}

async function apiGet(token, method) {
  // method like 'getWebhookInfo' or 'getMe' - simple GET
  const url = `${TELEGRAM_API(token)}/${method}`;
  const res = await fetch(url);
  try { return await res.json(); } catch (e) { return { ok: false, error: String(e) }; }
}

/* sendDocument using FormData/Blob */
async function sendDocument(token, chat_id, filename, content) {
  const url = TELEGRAM_FILE_API(token);
  const form = new FormData();
  form.append("chat_id", String(chat_id));
  const blob = new Blob([content], { type: "text/plain" });
  form.append("document", blob, filename);
  const res = await fetch(url, { method: "POST", body: form });
  try { return await res.json(); } catch (e) { return { ok: false, error: String(e) }; }
}

/* Markdown fallback: try Markdown then plain */
async function sendWithMarkdownFallback(token, chat_id, text, extra = {}) {
  const r = await sendMessage(token, chat_id, text, { parse_mode: "Markdown", ...extra }).catch(() => null);
  if (r && r.ok) return r;
  return await sendMessage(token, chat_id, text.replace(/[*_`[\]]/g, ""), extra);
}

/* ================== User helpers ================== */
function getDefaults() {
  return { language: "ru", model: DEFAULT_MODEL, temp: DEFAULT_TEMP, allow_requests: true, waiting_for_addbot_token: false };
}
function getUser(chat_id) {
  if (!userStore.has(chat_id)) userStore.set(chat_id, { ...getDefaults() });
  return userStore.get(chat_id);
}
function setUser(chat_id, obj) {
  const cur = getUser(chat_id);
  const merged = { ...cur, ...obj };
  userStore.set(chat_id, merged);
  return merged;
}

/* dedupe */
function seenUpdate(update_id) {
  if (!update_id) return false;
  if (recentUpdates.has(update_id)) return true;
  recentUpdates.add(update_id);
  if (recentUpdates.size > MAX_RECENT) {
    const it = recentUpdates.values();
    const first = it.next().value;
    recentUpdates.delete(first);
  }
  return false;
}

/* ================== Model query (improved) ================== */
async function queryModel(modelParam, messages, temperature = DEFAULT_TEMP) {
  const payload = { model: modelParam, messages, temperature };
  try {
    const res = await fetch(HF_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      let t = "";
      try { t = await res.text(); } catch {}
      if (res.status === 404) return "❌ Модель не найдена. Попробуй другую через /model";
      if (res.status === 401) return "🚫 Ошибка авторизации Hugging Face. Проверь HF_TOKEN.";
      if (res.status >= 500) return "⚙️ Сервер моделей перегружен. Попробуй позже.";
      return `⚠️ Ошибка (${res.status}). ${t ? t.slice(0,120) : ""}`;
    }
    const j = await res.json().catch(() => ({}));
    const content = j?.choices?.[0]?.message?.content ?? j?.output ?? (typeof j === "string" ? j : JSON.stringify(j));
    if (!content || (typeof content === "string" && content.trim() === "")) return "🤔 Модель вернула пустой ответ. Попробуй переформулировать запрос.";
    return String(content);
  } catch (e) {
    console.error("queryModel error:", e);
    return "🌐 Ошибка сети или Cloudflare завис. Попробуй ещё разок.";
  }
}

/* ================== HTML Page (your design preserved) ================== */
function renderHTML() {
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BOT_NAME}</title>
<style>
:root{--bg1:#0f2027;--bg2:#203a43;--accent:#00b7ff}
html,body{height:100%;margin:0}
body{font-family:Inter,ui-sans-serif,system-ui,Segoe UI,Roboto;background:linear-gradient(120deg,var(--bg1),var(--bg2));display:flex;align-items:center;justify-content:center;color:#fff}
.card{width:min(920px,94%);background:linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02));border-radius:14px;padding:28px;box-shadow:0 8px 30px rgba(0,0,0,0.5)}
h1{margin:0 0 8px;font-size:28px}
p.lead{margin:0 0 18px;opacity:.95}
.buttons{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}
.btn{background:var(--accent);color:#012;padding:10px 14px;border-radius:10px;border:none;cursor:pointer;font-weight:700}
.btn.secondary{background:rgba(255,255,255,0.06);color:#fff}
.footer{margin-top:18px;font-size:13px;opacity:.8}
.note{margin-top:8px;font-size:12px;opacity:.8}
a{color:inherit;text-decoration:none}
@media (max-width:720px){ .card{padding:18px} h1{font-size:22px} }
</style>
</head>
<body>
  <div class="card">
    <h1>🤖 ${BOT_NAME}</h1>
    <p class="lead">Easy AI, easy tasks. Working on CFW + HF API (TWH for bot too). WARN: I think updates not coming at least until 2028!!!</p>

    <div class="buttons">
      <a href="https://t.me/AbikusGPT_bot" target="_blank"><button class="btn">Get it right now</button></a>
      <button class="btn secondary" disabled>I tried to enable public, but it didnt work :(</button>
    </div>

    <div class="note">Our GitHub: https://github.com/AbikusSudo/</div>
    <div class="footer">TM 2025 AbikusSudo — We maked AbikusGPT and I own this platform.</div>
  </div>
</body>
</html>`;
}

/* ================== Command Handlers (preserve Python messages) ================== */

async function handle_start(chat_id) {
  const keyboard = {
    inline_keyboard: [
      [{ text: Emoji.LANGUAGES.ru, callback_data: "set_lang_ru" }],
      [{ text: Emoji.LANGUAGES.en, callback_data: "set_lang_en" }]
    ]
  };
  await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("welcome", "en"), { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_help(chat_id) {
  const lang = getUser(chat_id).language || "ru";
  await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("help", lang), { parse_mode: "HTML" });
}

async function handle_about(chat_id) {
  const lang = getUser(chat_id).language || "ru";
  await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("about", lang), { parse_mode: "HTML" });
}

async function handle_language(chat_id) {
  const lang = getUser(chat_id).language || "ru";
  const keyboard = {
    inline_keyboard: [
      [{ text: Emoji.LANGUAGES.ru, callback_data: "set_lang_ru" }],
      [{ text: Emoji.LANGUAGES.en, callback_data: "set_lang_en" }]
    ]
  };
  await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("select_language", lang), { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_model(chat_id) {
  const keyboard = { inline_keyboard: Object.keys(MODEL_MAP).map(name => [{ text: name, callback_data: `set_model_${name}` }]) };
  await sendMessage(TELEGRAM_TOKEN, chat_id, `🤖 <b>Выберите модель ИИ:</b>`, { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_stop(chat_id, from_user) {
  if ((from_user.username || "").toLowerCase() !== OWNER_USERNAME.toLowerCase()) {
    await sendMessage(TELEGRAM_TOKEN, chat_id, "🚫 Эта команда доступна только владельцу");
    return;
  }
  await sendMessage(TELEGRAM_TOKEN, chat_id, "🛑 Останавливаю бота... (Cloudflare Worker не останавливается вручную)");
}

async function handle_clear(chat_id) {
  userStore.delete(chat_id);
  await sendMessage(TELEGRAM_TOKEN, chat_id, "🧹 Локальные настройки очищены (in-memory).");
}

async function handle_allow(chat_id, flag) {
  setUser(chat_id, { allow_requests: flag });
  await sendMessage(TELEGRAM_TOKEN, chat_id, flag ? "✅ Запросы разрешены" : "⛔ Запросы запрещены");
}

/* ========== /addbot flow ========== */
/*
  /addbot -> bot instructs to send token:...
  When 'token:...' received (and user waiting_for_addbot_token true):
    - call setWebhook on that token with url = WEBHOOK_BASE + ADD_BOT_WEBHOOK_PATH
    - call getWebhookInfo to verify
    - call getMe to get username (for success message)
*/
async function handle_addbot_request(chat_id) {
  setUser(chat_id, { waiting_for_addbot_token: true });
  const msg = `⚙️ Чтобы создать копию бота, отправьте токен нового бота\n\n` +
              `Мы установим нашу систему\n\n\n` +
              `Пример токена: 123456:ABC-DEFghIJKlmnoPQRsTUVwxyZ\n\n` +
              `Используйте @BotFather чтобы получить токен.`;
  // Add quick link to BotFather
  const keyboard = { inline_keyboard: [[{ text: "Открыть @BotFather", url: "https://t.me/BotFather" }]] };
  await sendMessage(TELEGRAM_TOKEN, chat_id, msg, { reply_markup: keyboard });
}

/* Process incoming token message */
async function process_addbot_token(chat_id, rawToken, from_user) {
  // Clear waiting flag
  setUser(chat_id, { waiting_for_addbot_token: false });

  const token = rawToken.trim();
  if (!token || !token.startsWith("token:")) {
    // not in correct format
    await sendMessage(TELEGRAM_TOKEN, chat_id, "Формат неверный. Отправьте в виде: token:ВАШ_ТОКЕН");
    return;
  }
  const provided = token.slice("token:".length).trim();
  if (!provided) {
    await sendMessage(TELEGRAM_TOKEN, chat_id, "Пустой токен. Отправьте токен в формате: token:ВАШ_ТОКЕН");
    return;
  }

  // Inform user
  await sendMessage(TELEGRAM_TOKEN, chat_id, "🔧 Пытаюсь настроить webhook для вашего бота... Подождите секундочку.");

  try {
    // 1) setWebhook
    const webhookUrl = `${WEBHOOK_BASE}${ADD_BOT_WEBHOOK_PATH}`;
    const setResp = await fetch(`${TELEGRAM_API(provided)}/setWebhook?url=${encodeURIComponent(webhookUrl)}`);
    const setJson = await setResp.json().catch(() => null);

    if (!setJson || setJson.ok !== true) {
      // try to return error message from API
      const err = setJson && setJson.description ? setJson.description : `Не удалось вызвать setWebhook. Ответ: ${JSON.stringify(setJson)}`;
      await sendMessage(TELEGRAM_TOKEN, chat_id, `❌ Не удалось настроить webhook: ${err}\nВозвращаемся в меню...`);
      return;
    }

    // 2) getWebhookInfo
    const getInfoResp = await fetch(`${TELEGRAM_API(provided)}/getWebhookInfo`);
    const infoJson = await getInfoResp.json().catch(() => null);

    const configuredUrl = infoJson?.result?.url || "";
    if (!configuredUrl || configuredUrl.indexOf(ADD_BOT_WEBHOOK_PATH) === -1) {
      await sendMessage(TELEGRAM_TOKEN, chat_id, `❌ Не настроен правильно. Проверьте токен и права бота. Возвращаемся в меню...`);
      return;
    }

    // 3) getMe to obtain username
    const meJson = await (await fetch(`${TELEGRAM_API(provided)}/getMe`)).json().catch(() => null);
    const username = meJson?.result?.username ? `@${meJson.result.username}` : (meJson?.result?.id ? `ID:${meJson.result.id}` : "(не удалось получить имя)");

    // Success message format requested:
    // ✅ Бот @ИмяБота успешно подключён!
    // 🌐 Возращаемся в меню...
    await sendMessage(TELEGRAM_TOKEN, chat_id, `✅ Бот ${username} успешно подключён!\n🌐 Возращаемся в меню...`);

  } catch (e) {
    console.error("process_addbot_token error:", e);
    await sendMessage(TELEGRAM_TOKEN, chat_id, `❌ Произошла ошибка при попытке настроить бот. Проверьте токен и права. Возвращаемся в меню...`);
  }
}

/* ================== Main Worker Export ================== */
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

    // Root / index page
    if (method === "GET" && (path === "/" || path === "/index.html")) {
      return new Response(renderHTML(), { headers: { "content-type": "text/html; charset=utf-8" } });
    }

    // Simple GET /api?text=... for testing
    if (path === "/api" && method === "GET") {
      const text = url.searchParams.get("text") || "";
      const modelQ = url.searchParams.get("model") || DEFAULT_MODEL;
      const temp = parseFloat(url.searchParams.get("temp") || DEFAULT_TEMP);
      if (!text) return new Response(JSON.stringify({ ok: false, error: "no text provided" }), { status: 400, headers: { "content-type": "application/json" } });
      const reply = await queryModel(modelQ, [{ role: "user", content: text }], temp);
      return new Response(JSON.stringify({ ok: true, model: modelQ, input: text, reply }), { headers: { "content-type": "application/json" } });
    }

    // === Webhook for main bot ===
    if (path === WEBHOOK_PATH && method === "POST") {
      let update;
      try { update = await request.json(); } catch (e) { return new Response("bad request", { status: 400 }); }
      if (!update) return new Response("ok", { status: 200 });

      // dedupe
      if (seenUpdate(update.update_id)) return new Response("ok", { status: 200 });

      // callback_query handling (inline)
      if (update.callback_query) {
        const cb = update.callback_query;
        const data = cb.data || "";
        const chat_id = cb.message?.chat?.id || cb.from?.id;
        const from = cb.from || {};

        if (data.startsWith("set_lang_")) {
          const lang = data.split("_").pop();
          setUser(chat_id, { language: lang });
          await answerCallback(TELEGRAM_TOKEN, cb.id, Translations.get_text("language_set", lang));
          try {
            await editMessageText(TELEGRAM_TOKEN, chat_id, cb.message.message_id, Translations.get_text("language_set", lang), { parse_mode: "HTML" });
            await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("features", lang), { parse_mode: "HTML" });
          } catch (e) {}
          return new Response("ok", { status: 200 });
        }

        if (data.startsWith("set_model_")) {
          const model_name = data.split("_").slice(2).join("_");
          if (!(model_name in MODEL_MAP)) {
            await answerCallback(TELEGRAM_TOKEN, cb.id, "❌ Неизвестная модель");
            return new Response("ok", { status: 200 });
          }
          setUser(chat_id, { model: MODEL_MAP[model_name] });
          await answerCallback(TELEGRAM_TOKEN, cb.id, `✅ Выбрана модель: ${model_name}`);
          try { await editMessageText(TELEGRAM_TOKEN, chat_id, cb.message.message_id, `✅ Выбрана модель: <b>${model_name}</b>`, { parse_mode: "HTML" }); } catch (e) {}
          return new Response("ok", { status: 200 });
        }

        // unknown callback
        await answerCallback(TELEGRAM_TOKEN, cb.id, "");
        return new Response("ok", { status: 200 });
      }

      // message handling for main bot
      if (update.message) {
        const msg = update.message;
        const chat_id = msg.chat.id;
        const from = msg.from || {};
        const text = (msg.text || "").trim();

        if (!text) return new Response("ok", { status: 200 });

        // Commands
        if (text.startsWith("/")) {
          const parts = text.split(" ");
          const cmd = parts[0].toLowerCase();

          if (cmd === "/start") { await handle_start(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/help") { await handle_help(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/about") { await handle_about(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/language") { await handle_language(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/model") { await handle_model(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/stop") { await handle_stop(chat_id, from); return new Response("ok", { status: 200 }); }
          if (cmd === "/clear") { await handle_clear(chat_id); return new Response("ok", { status: 200 }); }
          if (cmd === "/allow") { const cur = getUser(chat_id); await handle_allow(chat_id, !cur.allow_requests); return new Response("ok", { status: 200 }); }
          if (cmd === "/addbot") { await handle_addbot_request(chat_id); return new Response("ok", { status: 200 }); }

          // unknown command
          await sendMessage(TELEGRAM_TOKEN, chat_id, "Неизвестная команда. Напишите /help");
          return new Response("ok", { status: 200 });
        }

        // If user is in addbot "waiting_for_addbot_token" state, check token message
        const user = getUser(chat_id);
        if (user.waiting_for_addbot_token && text.toLowerCase().startsWith("token:")) {
          // process token (text should be like 'token:123:ABC')
          await process_addbot_token(chat_id, text, from);
          return new Response("ok", { status: 200 });
        }

        // Normal message -> AI flow
        try {
          const settings = getUser(chat_id);
          if (settings.allow_requests === false && (from.username || "").toLowerCase() !== OWNER_USERNAME.toLowerCase()) {
            await sendMessage(TELEGRAM_TOKEN, chat_id, "⛔ Запросы временно отключены");
            return new Response("ok", { status: 200 });
          }

          const lang = settings.language || "ru";
          const model = settings.model || DEFAULT_MODEL;
          const temp = settings.temp || DEFAULT_TEMP;

          // Processing message
          const processingText = Translations.get_text("processing", lang);
          const sending = await sendMessage(TELEGRAM_TOKEN, chat_id, processingText, { parse_mode: "HTML" });
          const processing_message_id = sending?.result?.message_id;

          // System prompt
          const systemPrompt = lang === "ru"
            ? (Translations.get_text("welcome", "ru") + "\nТы — AbikusGPT, ассистент от Abikus. Отвечай по-русски.")
            : (Translations.get_text("welcome", "en") + "\nYou are AbikusGPT, assistant by Abikus.");

          const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
          ];

          const startTs = Date.now();
          const aiText = await queryModel(model, messages, temp);
          const elapsed = ((Date.now() - startTs) / 1000).toFixed(2);

          const header = Translations.get_text("ai_response", lang);
          const finalText = `${header}\n\n${aiText}\n\n${Emoji.FOOTER}\n⏱️ Время обработки: ${elapsed}s`;

          // If short enough - send as message (Markdown attempt via fallback), else send as file
          if ((finalText || "").length <= 4096) {
            await sendWithMarkdownFallback(TELEGRAM_TOKEN, chat_id, finalText, { disable_web_page_preview: true });
            try { if (processing_message_id) await deleteMessage(TELEGRAM_TOKEN, chat_id, processing_message_id); } catch (e) {}
          } else {
            // send as document
            try {
              try { if (processing_message_id) await deleteMessage(TELEGRAM_TOKEN, chat_id, processing_message_id); } catch (e) {}
              await sendDocument(TELEGRAM_TOKEN, chat_id, "response.txt", finalText);
            } catch (e) {
              // fallback chunking
              let txt = finalText;
              while (txt.length > 0) {
                const chunk = txt.slice(0, 4000);
                await sendWithMarkdownFallback(TELEGRAM_TOKEN, chat_id, chunk);
                txt = txt.slice(4000);
              }
            }
          }

        } catch (e) {
          console.error("handle message error:", e);
          const lang = getUser(chat_id).language || "ru";
          await sendMessage(TELEGRAM_TOKEN, chat_id, Translations.get_text("connection_error", lang), { parse_mode: "HTML" });
        }

        return new Response("ok", { status: 200 });
      }

      return new Response("ok", { status: 200 });
    }

    // === Webhook endpoint for added bots (they post updates here) ===
    if (path === ADD_BOT_WEBHOOK_PATH && method === "POST") {
      // For now: accept updates but do not process as main bot.
      // Optionally, you can log or forward certain updates.
      try { await request.json().catch(() => null); } catch {}
      return new Response("ok", { status: 200 });
    }

    // Not Found
    return new Response("Not Found", { status: 404 });
  }
};
