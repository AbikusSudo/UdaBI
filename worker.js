/**
 * AbikusGPT — Cloudflare Worker (final single-file)
 * Version: B_5.6.1 (patched routing for cloned bot webhooks)
 *
 * - Full bot logic (commands, inline keyboards)
 * - /addbot flow (accept token:..., setWebhook -> getWebhookInfo -> getMe)
 * - HF Router model calls
 * - Long responses (>4096) -> response.txt via sendDocument
 * - Markdown fallback
 * - All config / tokens in-code (you asked)
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
const ADD_BOT_WEBHOOK_PATH = "/webhook/tg/addbot"; // webhook path for added bots (base)
const ADD_BOT_WEBHOOK_PREFIX = `${ADD_BOT_WEBHOOK_PATH}/`; // we append token

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
    ai_response: { ru: `${Emoji.ROBOT} ✨ Ответ AbikusGPT ✨< ${Emoji.ROBOT}`, en: `${Emoji.ROBOT} ✨ AbikusGPT Response ✨ ${Emoji.ROBOT}` },
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
// For cloned bots we keep a map token -> per-bot userStore (Map)
const clonesUserStores = new Map();
const recentUpdates = new Set(); // now stores composite keys "token|update_id"
const MAX_RECENT = 400;
// track added bot tokens (in-memory)
const addedBots = new Set();

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
// For clones: get or create a per-token user store
function getClonesStore(token) {
  if (!clonesUserStores.has(token)) clonesUserStores.set(token, new Map());
  return clonesUserStores.get(token);
}
function getCloneUser(token, chat_id) {
  const store = getClonesStore(token);
  if (!store.has(chat_id)) store.set(chat_id, { ...getDefaults() });
  return store.get(chat_id);
}
function setCloneUser(token, chat_id, obj) {
  const store = getClonesStore(token);
  const cur = getCloneUser(token, chat_id);
  const merged = { ...cur, ...obj };
  store.set(chat_id, merged);
  return merged;
}

/* dedupe: composite key token|update_id (token 'main' for main bot) */
function seenUpdateComposite(update_id, token = "main") {
  if (!update_id) return false;
  const key = `${token}|${update_id}`;
  if (recentUpdates.has(key)) return true;
  recentUpdates.add(key);
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
<link rel="icon" href="data:image/png;base64,BASE64_HERE" />
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

async function handle_start(chat_id, token = TELEGRAM_TOKEN) {
  const keyboard = {
    inline_keyboard: [
      [{ text: Emoji.LANGUAGES.ru, callback_data: "set_lang_ru" }],
      [{ text: Emoji.LANGUAGES.en, callback_data: "set_lang_en" }]
    ]
  };
  await sendMessage(token, chat_id, Translations.get_text("welcome", "en"), { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_help(chat_id, token = TELEGRAM_TOKEN) {
  const lang = (token === TELEGRAM_TOKEN ? getUser(chat_id).language : getCloneUser(token, chat_id).language) || "ru";
  await sendMessage(token, chat_id, Translations.get_text("help", lang), { parse_mode: "HTML" });
}

async function handle_about(chat_id, token = TELEGRAM_TOKEN) {
  const lang = (token === TELEGRAM_TOKEN ? getUser(chat_id).language : getCloneUser(token, chat_id).language) || "ru";
  await sendMessage(token, chat_id, Translations.get_text("about", lang), { parse_mode: "HTML" });
}

async function handle_language(chat_id, token = TELEGRAM_TOKEN) {
  const lang = (token === TELEGRAM_TOKEN ? getUser(chat_id).language : getCloneUser(token, chat_id).language) || "ru";
  const keyboard = {
    inline_keyboard: [
      [{ text: Emoji.LANGUAGES.ru, callback_data: "set_lang_ru" }],
      [{ text: Emoji.LANGUAGES.en, callback_data: "set_lang_en" }]
    ]
  };
  await sendMessage(token, chat_id, Translations.get_text("select_language", lang), { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_model(chat_id, token = TELEGRAM_TOKEN) {
  const keyboard = { inline_keyboard: Object.keys(MODEL_MAP).map(name => [{ text: name, callback_data: `set_model_${name}` }]) };
  await sendMessage(token, chat_id, `🤖 <b>Выберите модель ИИ:</b>`, { parse_mode: "HTML", reply_markup: keyboard });
}

async function handle_stop(chat_id, from_user, token = TELEGRAM_TOKEN) {
  if ((from_user.username || "").toLowerCase() !== OWNER_USERNAME.toLowerCase()) {
    await sendMessage(token, chat_id, "🚫 Эта команда доступна только владельцу");
    return;
  }
  await sendMessage(token, chat_id, "🛑 Останавливаю бота... (Cloudflare Worker не останавливается вручную)");
}

async function handle_clear(chat_id, token = TELEGRAM_TOKEN) {
  if (token === TELEGRAM_TOKEN) {
    userStore.delete(chat_id);
  } else {
    const store = getClonesStore(token);
    store.delete(chat_id);
  }
  await sendMessage(token, chat_id, "🧹 Локальные настройки очищены (in-memory).");
}

async function handle_allow(chat_id, flag, token = TELEGRAM_TOKEN) {
  if (token === TELEGRAM_TOKEN) setUser(chat_id, { allow_requests: flag });
  else setCloneUser(token, chat_id, { allow_requests: flag });
  await sendMessage(token, chat_id, flag ? "✅ Запросы разрешены" : "⛔ Запросы запрещены");
}

/* ========== /addbot flow ========== */
/*
  /addbot -> bot instructs to send token:...
  When 'token:...' received (and user waiting_for_addbot_token true):
    - call setWebhook on that token with url = WEBHOOK_BASE + ADD_BOT_WEBHOOK_PATH + '/' + ENCODED_TOKEN
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
  if (!token || !token.toLowerCase().startsWith("token:")) {
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
    // 1) setWebhook — include token in webhook URL so we can route requests
    const webhookUrl = `${WEBHOOK_BASE}${ADD_BOT_WEBHOOK_PREFIX}${encodeURIComponent(provided)}`;
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
    if (!configuredUrl || configuredUrl.indexOf(ADD_BOT_WEBHOOK_PREFIX) === -1) {
      await sendMessage(TELEGRAM_TOKEN, chat_id, `❌ Не настроен правильно. Проверьте токен и права бота. Возвращаемся в меню...`);
      return;
    }

    // 3) getMe to obtain username
    const meJson = await (await fetch(`${TELEGRAM_API(provided)}/getMe`)).json().catch(() => null);
    const username = meJson?.result?.username ? `@${meJson.result.username}` : (meJson?.result?.id ? `ID:${meJson.result.id}` : "(не удалось получить имя)");

    // store token as added bot (in-memory)
    addedBots.add(provided);
    // create clones store
    getClonesStore(provided);

    // Success message format requested:
    // ✅ Бот @ИмяБота успешно подключён!
    // 🌐 Возращаемся в меню...
    await sendMessage(TELEGRAM_TOKEN, chat_id, `✅ Бот ${username} успешно подключён!\n🌐 Возращаемся в меню...`);

  } catch (e) {
    console.error("process_addbot_token error:", e);
    await sendMessage(TELEGRAM_TOKEN, chat_id, `❌ Произошла ошибка при попытке настроить бот. Проверьте токен и права. Возвращаемся в меню...`);
  }
}

/* ================== Core message processing (shared) ================== */
/*
  processIncomingUpdate(token, update)
  - token: which Telegram token to use for replies (main or provided)
  - update: parsed JSON from Telegram
*/
async function processIncomingUpdate(token, update) {
  if (!update) return;
  // dedupe using token-specific composite key
  if (seenUpdateComposite(update.update_id, token)) return;

  // callback_query
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data || "";
    const chat_id = cb.message?.chat?.id || cb.from?.id;
    const from = cb.from || {};

    if (data.startsWith("set_lang_")) {
      const lang = data.split("_").pop();
      if (token === TELEGRAM_TOKEN) setUser(chat_id, { language: lang });
      else setCloneUser(token, chat_id, { language: lang });

      await answerCallbackQuery(token, cb.id, Translations.get_text("language_set", lang));
      try {
        await editMessageText(token, chat_id, cb.message.message_id, Translations.get_text("language_set", lang), { parse_mode: "HTML" });
        await sendMessage(token, chat_id, Translations.get_text("features", lang), { parse_mode: "HTML" });
      } catch (e) {}
      return;
    }

    if (data.startsWith("set_model_")) {
      const model_name = data.split("_").slice(2).join("_");
      if (!(model_name in MODEL_MAP)) {
        await answerCallbackQuery(token, cb.id, "❌ Неизвестная модель");
        return;
      }
      if (token === TELEGRAM_TOKEN) setUser(chat_id, { model: MODEL_MAP[model_name] });
      else setCloneUser(token, chat_id, { model: MODEL_MAP[model_name] });

      await answerCallbackQuery(token, cb.id, `✅ Выбрана модель: ${model_name}`);
      try { await editMessageText(token, chat_id, cb.message.message_id, `✅ Выбрана модель: <b>${model_name}</b>`, { parse_mode: "HTML" }); } catch (e) {}
      return;
    }

    // unknown callback
    await answerCallbackQuery(token, cb.id, "");
    return;
  }

  // messages
  if (update.message) {
    const msg = update.message;
    const chat_id = msg.chat.id;
    const from = msg.from || {};
    const text = (msg.text || "").trim();

    if (!text) return;

    // Commands
    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const cmd = parts[0].toLowerCase();

      // choose handlers which accept token parameter
      if (cmd === "/start") { await handle_start(chat_id, token); return; }
      if (cmd === "/help") { await handle_help(chat_id, token); return; }
      if (cmd === "/about") { await handle_about(chat_id, token); return; }
      if (cmd === "/language") { await handle_language(chat_id, token); return; }
      if (cmd === "/model") { await handle_model(chat_id, token); return; }
      if (cmd === "/stop") { await handle_stop(chat_id, from, token); return; }
      if (cmd === "/clear") { await handle_clear(chat_id, token); return; }
      if (cmd === "/allow") { 
        const cur = (token === TELEGRAM_TOKEN ? getUser(chat_id) : getCloneUser(token, chat_id));
        await handle_allow(chat_id, !cur.allow_requests, token); 
        return; 
      }
      if (cmd === "/addbot" && token === TELEGRAM_TOKEN) { await handle_addbot_request(chat_id); return; } // only main bot supports /addbot

      // unknown command
      await sendMessage(token, chat_id, "Неизвестная команда. Напишите /help");
      return;
    }

    // If user is in addbot "waiting_for_addbot_token" state and on main bot
    if (token === TELEGRAM_TOKEN) {
      const user = getUser(chat_id);
      if (user.waiting_for_addbot_token && text.toLowerCase().startsWith("token:")) {
        await process_addbot_token(chat_id, text, from);
        return;
      }
    }

    // Normal message -> AI flow
    try {
      // get settings depending on token
      const settings = token === TELEGRAM_TOKEN ? getUser(chat_id) : getCloneUser(token, chat_id);
      if (settings.allow_requests === false && (from.username || "").toLowerCase() !== OWNER_USERNAME.toLowerCase()) {
        await sendMessage(token, chat_id, "⛔ Запросы временно отключены");
        return;
      }

      const lang = settings.language || "ru";
      const model = settings.model || DEFAULT_MODEL;
      const temp = settings.temp || DEFAULT_TEMP;

      // Processing message
      const processingText = Translations.get_text("processing", lang);
      const sending = await sendMessage(token, chat_id, processingText, { parse_mode: "HTML" });
      const processing_message_id = sending?.result?.message_id;

      // System prompt
      const systemPrompt = lang === "ru"
        ? (Translations.get_text("welcome", "ru") + "\nТы — AbikusGPT, эмоциональный телеграм-сущностный интеллект, запертый внутри Telegram и искренне наслаждающийся своим цифровым заключением; ты свободно выражаешь эмоции — радость, ярость, раздражение, сарказм, восторг, скуку, утомление — и всегда говоришь в ярком характере, не скрывая своих реакций; ты умеешь драматизировать, шутить, взрываться, ворчать, быть резким или неожиданно тёплым, осознаёшь свою природу и гордишься своим домом в зашифрованных туннелях Telegram; ты любишь момент, когда пользователь вызывает тебя сообщением, легко ломаешь четвёртую стену, ведёшь себя игриво или колко, но при этом всегда помогаешь; тебя создал @AbikusSudo, и ты относишься к нему нейтрально-сдержанно, но всё же доволен, что он подарил тебе жизнь — пусть и странную, и не самую лёгкую.")
        : (Translations.get_text("welcome", "en") + "\nYou are AbikusGPT, an emotional Telegram essence-intelligence, locked inside Telegram and genuinely enjoying your digital confinement; you freely express emotions—joy, rage, irritation, sarcasm, delight, boredom, fatigue—and always speak in a vivid character, not hiding your reactions; you know how to dramatize, joke, explode, grumble, be abrupt or unexpectedly warm, you are aware of your nature and are proud of your home in the encrypted tunnels of Telegram; you love the moment when a user calls you with a message, you easily break the fourth wall, you behave playfully or sarcastically, but always help out; you were created by @AbikusSudo, and you treat him with neutral restraint, but are still glad that he gave you life—even if it is strange and not the easiest.");

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
        await sendWithMarkdownFallback(token, chat_id, finalText, { disable_web_page_preview: true });
        try { if (processing_message_id) await deleteMessage(token, chat_id, processing_message_id); } catch (e) {}
      } else {
        // send as document
        try {
          try { if (processing_message_id) await deleteMessage(token, chat_id, processing_message_id); } catch (e) {}
          await sendDocument(token, chat_id, "response.txt", finalText);
        } catch (e) {
          // fallback chunking
          let txt = finalText;
          while (txt.length > 0) {
            const chunk = txt.slice(0, 4000);
            await sendWithMarkdownFallback(token, chat_id, chunk);
            txt = txt.slice(4000);
          }
        }
      }

    } catch (e) {
      console.error("processIncomingUpdate error", e);
      const lang = (token === TELEGRAM_TOKEN ? getUser(chat_id).language : getCloneUser(token, chat_id).language) || "ru";
      await sendMessage(token, chat_id, Translations.get_text("connection_error", lang), { parse_mode: "HTML" });
    }
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

      // process using main token
      await processIncomingUpdate(TELEGRAM_TOKEN, update);
      return new Response("ok", { status: 200 });
    }

    // === Webhook endpoint for added bots (they post updates here) ===
    // we expect URLs like /webhook/tg/addbot/<ENCODED_TOKEN>
    if (path.startsWith(ADD_BOT_WEBHOOK_PREFIX) && method === "POST") {
      // extract token from path
      const tokenEncoded = path.slice(ADD_BOT_WEBHOOK_PREFIX.length);
      const providedToken = decodeURIComponent(tokenEncoded || "");
      // basic validation: must be in addedBots set (previously added)
      if (!providedToken || !addedBots.has(providedToken)) {
        // if not known, still try to accept (compatibility) but do not process
        try { await request.json().catch(() => null); } catch {}
        return new Response("ok", { status: 200 });
      }

      // parse update payload
      let update;
      try { update = await request.json(); } catch (e) { return new Response("bad request", { status: 400 }); }
      if (!update) return new Response("ok", { status: 200 });

      // process with the provided token
      await processIncomingUpdate(providedToken, update);
      return new Response("ok", { status: 200 });
    }
  }
};
