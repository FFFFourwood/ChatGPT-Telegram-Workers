// src/env.js
var ENV_VALUE_TYPE = {
  API_KEY: "string"
};
var ENV = {
  // OpenAI API Key
  API_KEY: null,
  // OpenAI的模型名称
  CHAT_MODEL: "gpt-3.5-turbo",
  // 允许访问的Telegram Token， 设置时以逗号分隔
  TELEGRAM_AVAILABLE_TOKENS: [],
  // 允许访问的Telegram Token 对应的Bot Name， 设置时以逗号分隔
  TELEGRAM_BOT_NAME: [],
  // 允许所有人使用
  I_AM_A_GENEROUS_PERSON: false,
  //管理员联系方式
  ADMIN_CONTECT: "",
  //打开群白名单
  GROUP_WL_ENABLE: true,
  //打开私聊白名单
  CHAT_WL_ENABLE: true,
  // 白名单
  CHAT_WHITE_LIST: [],
  // 群组白名单
  CHAT_GROUP_WHITE_LIST: [],
  // 群组机器人开关
  GROUP_CHAT_BOT_ENABLE: true,
  // 群组机器人共享模式,关闭后，一个群组只有一个会话和配置。开启的话群组的每个人都有自己的会话上下文
  GROUP_CHAT_BOT_SHARE_MODE: true,
  // 为了避免4096字符限制，将消息删减
  AUTO_TRIM_HISTORY: true,
  // 最大历史记录长度
  MAX_HISTORY_LENGTH: 20,
  // 最大消息长度
  MAX_TOKEN_LENGTH: 2048,
  // 使用GPT3的TOKEN计数
  GPT3_TOKENS_COUNT: true,
  // 全局默认初始化消息
  SYSTEM_INIT_MESSAGE: "you are a great assistant",
  // 全局默认初始化消息角色
  SYSTEM_INIT_MESSAGE_ROLE: "system",
  // 是否开启使用统计
  ENABLE_USAGE_STATISTICS: false,
  // 隐藏部分命令按钮
  HIDE_COMMAND_BUTTONS: [],
  // 检查更新的分支
  UPDATE_BRANCH: "main-arthur-release",
  // 当前版本
  BUILD_TIMESTAMP: 1680445501,
  // 当前版本 commit id
  BUILD_VERSION: "23713d7",
  // DEBUG 专用
  // 调试模式
  DEBUG_MODE: false,
  // 开发模式
  DEV_MODE: false,
  // 本地调试专用
  TELEGRAM_API_DOMAIN: "https://api.telegram.org",
  OPENAI_API_DOMAIN: "https://api.openai.com"
};
var CONST = {
  PASSWORD_KEY: "chat_history_password",
  GROUP_TYPES: ["group", "supergroup"],
  USER_AGENT: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Safari/605.1.15"
};
var DATABASE = null;
function initEnv(env) {
  DATABASE = env.DATABASE;
  for (const key in ENV) {
    if (env[key]) {
      switch (ENV_VALUE_TYPE[key] || typeof ENV[key]) {
        case "number":
          ENV[key] = parseInt(env[key]) || ENV[key];
          break;
        case "boolean":
          ENV[key] = (env[key] || "false") === "true";
          break;
        case "string":
          ENV[key] = env[key];
          break;
        case "object":
          if (Array.isArray(ENV[key])) {
            ENV[key] = env[key].split(",");
          } else {
            try {
              ENV[key] = JSON.parse(env[key]);
            } catch (e) {
              console.error(e);
            }
          }
          break;
        default:
          ENV[key] = env[key];
          break;
      }
    }
  }
  {
    if (env.TELEGRAM_TOKEN && !ENV.TELEGRAM_AVAILABLE_TOKENS.includes(env.TELEGRAM_TOKEN)) {
      if (env.BOT_NAME && ENV.TELEGRAM_AVAILABLE_TOKENS.length === ENV.TELEGRAM_BOT_NAME.length) {
        ENV.TELEGRAM_BOT_NAME.push(env.BOT_NAME);
      }
      ENV.TELEGRAM_AVAILABLE_TOKENS.push(env.TELEGRAM_TOKEN);
    }
  }
}

// src/context.js
var USER_CONFIG = {
  // 系统初始化消息
  SYSTEM_INIT_MESSAGE: ENV.SYSTEM_INIT_MESSAGE,
  // OpenAI API 额外参数
  OPENAI_API_EXTRA_PARAMS: {}
};
var USER_DEFINE = {
  // 自定义角色
  ROLE: {}
};
var CURRENT_CHAT_CONTEXT = {
  chat_id: null,
  reply_to_message_id: null,
  // 如果是群组，这个值为消息ID，否则为null
  parse_mode: "Markdown"
};
var SHARE_CONTEXT = {
  currentBotId: null,
  // 当前机器人 ID
  currentBotToken: null,
  // 当前机器人 Token
  currentBotName: null,
  // 当前机器人名称: xxx_bot
  chatHistoryKey: null,
  // history:chat_id:bot_id:(from_id)
  configStoreKey: null,
  // user_config:chat_id:bot_id:(from_id)
  groupAdminKey: null,
  // group_admin:group_id
  usageKey: null,
  // usage:bot_id
  chatType: null,
  // 会话场景, private/group/supergroup 等, 来源 message.chat.type
  chatId: null,
  // 会话 id, private 场景为发言人 id, group/supergroup 场景为群组 id
  speakerId: null
  // 发言人 id
};
function initChatContext(chatId, replyToMessageId) {
  CURRENT_CHAT_CONTEXT.chat_id = chatId;
  CURRENT_CHAT_CONTEXT.reply_to_message_id = replyToMessageId;
  if (replyToMessageId) {
    CURRENT_CHAT_CONTEXT.allow_sending_without_reply = true;
  }
}
async function initUserConfig(storeKey) {
  try {
    const userConfig = JSON.parse(await DATABASE.get(storeKey));
    for (const key in userConfig) {
      if (key === "USER_DEFINE" && typeof USER_DEFINE === typeof userConfig[key]) {
        initUserDefine(userConfig[key]);
      } else {
        if (USER_CONFIG.hasOwnProperty(key) && typeof USER_CONFIG[key] === typeof userConfig[key]) {
          USER_CONFIG[key] = userConfig[key];
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
}
function initUserDefine(userDefine) {
  for (const key in userDefine) {
    if (USER_DEFINE.hasOwnProperty(key) && typeof USER_DEFINE[key] === typeof userDefine[key]) {
      USER_DEFINE[key] = userDefine[key];
    }
  }
}
function initTelegramContext(request) {
  const { pathname } = new URL(request.url);
  const token = pathname.match(
    /^\/telegram\/(\d+:[A-Za-z0-9_-]{35})\/webhook/
  )[1];
  const telegramIndex = ENV.TELEGRAM_AVAILABLE_TOKENS.indexOf(token);
  if (telegramIndex === -1) {
    throw new Error("Token not allowed");
  }
  SHARE_CONTEXT.currentBotToken = token;
  SHARE_CONTEXT.currentBotId = token.split(":")[0];
  if (ENV.TELEGRAM_BOT_NAME.length > telegramIndex) {
    SHARE_CONTEXT.currentBotName = ENV.TELEGRAM_BOT_NAME[telegramIndex];
  }
}
async function initShareContext(message) {
  SHARE_CONTEXT.usageKey = `usage:${SHARE_CONTEXT.currentBotId}`;
  const id = message?.chat?.id;
  if (id === void 0 || id === null) {
    throw new Error("Chat id not found");
  }
  const botId = SHARE_CONTEXT.currentBotId;
  let historyKey = `history:${id}`;
  let configStoreKey = `user_config:${id}`;
  let groupAdminKey = null;
  if (botId) {
    historyKey += `:${botId}`;
    configStoreKey += `:${botId}`;
  }
  if (CONST.GROUP_TYPES.includes(message.chat?.type)) {
    if (!ENV.GROUP_CHAT_BOT_SHARE_MODE && message.from.id) {
      historyKey += `:${message.from.id}`;
      configStoreKey += `:${message.from.id}`;
    }
    groupAdminKey = `group_admin:${id}`;
  }
  SHARE_CONTEXT.chatHistoryKey = historyKey;
  SHARE_CONTEXT.configStoreKey = configStoreKey;
  SHARE_CONTEXT.groupAdminKey = groupAdminKey;
  SHARE_CONTEXT.chatType = message.chat?.type;
  SHARE_CONTEXT.chatId = message.chat.id;
  SHARE_CONTEXT.speakerId = message.from.id || message.chat.id;
}
async function initContext(message) {
  console.log(ENV);
  const chatId = message?.chat?.id;
  const replyId = CONST.GROUP_TYPES.includes(message.chat?.type) ? message.message_id : null;
  initChatContext(chatId, replyId);
  console.log(CURRENT_CHAT_CONTEXT);
  await initShareContext(message);
  console.log(SHARE_CONTEXT);
  await initUserConfig(SHARE_CONTEXT.configStoreKey);
  console.log(USER_CONFIG);
}

// src/telegram.js
async function sendMessage(message, token, context) {
  return await fetch(
    `${ENV.TELEGRAM_API_DOMAIN}/bot${token}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...context,
        text: message
      })
    }
  );
}
async function sendMessageToTelegram(message, token, context) {
  console.log("\u53D1\u9001\u6D88\u606F:\n", message);
  const botToken = token || SHARE_CONTEXT.currentBotToken;
  const chatContext = context || CURRENT_CHAT_CONTEXT;
  if (message.length <= 4096) {
    return await sendMessage(message, botToken, chatContext);
  }
  console.log("\u6D88\u606F\u5C06\u5206\u6BB5\u53D1\u9001");
  const limit = 4e3;
  chatContext.parse_mode = "HTML";
  for (let i = 0; i < message.length; i += limit) {
    const msg = message.slice(i, i + limit);
    await sendMessage(`<pre>
${msg}
</pre>`, botToken, chatContext);
  }
  return new Response("MESSAGE BATCH SEND", { status: 200 });
}
async function sendChatActionToTelegram(action, token) {
  return await fetch(
    `${ENV.TELEGRAM_API_DOMAIN}/bot${token || SHARE_CONTEXT.currentBotToken}/sendChatAction`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: CURRENT_CHAT_CONTEXT.chat_id,
        action
      })
    }
  ).then((res) => res.json());
}
async function bindTelegramWebHook(token, url) {
  return await fetch(
    `${ENV.TELEGRAM_API_DOMAIN}/bot${token}/setWebhook`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url
      })
    }
  ).then((res) => res.json());
}
async function getChatRole(id) {
  let groupAdmin;
  try {
    groupAdmin = JSON.parse(await DATABASE.get(SHARE_CONTEXT.groupAdminKey));
  } catch (e) {
    console.error(e);
    return e.message;
  }
  if (!groupAdmin || !Array.isArray(groupAdmin) || groupAdmin.length === 0) {
    const administers = await getChatAdminister(CURRENT_CHAT_CONTEXT.chat_id);
    if (administers == null) {
      return null;
    }
    groupAdmin = administers;
    await DATABASE.put(
      SHARE_CONTEXT.groupAdminKey,
      JSON.stringify(groupAdmin),
      { expiration: parseInt(Date.now() / 1e3) + 120 }
    );
  }
  for (let i = 0; i < groupAdmin.length; i++) {
    const user = groupAdmin[i];
    if (user.user.id === id) {
      return user.status;
    }
  }
  return "member";
}
async function getChatAdminister(chatId, token) {
  try {
    const resp = await fetch(
      `${ENV.TELEGRAM_API_DOMAIN}/bot${token || SHARE_CONTEXT.currentBotToken}/getChatAdministrators`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ chat_id: chatId })
      }
    ).then((res) => res.json());
    if (resp.ok) {
      return resp.result;
    }
  } catch (e) {
    console.error(e);
    return null;
  }
}
async function getBot(token) {
  const resp = await fetch(
    `${ENV.TELEGRAM_API_DOMAIN}/bot${token}/getMe`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  ).then((res) => res.json());
  if (resp.ok) {
    return {
      ok: true,
      info: {
        name: resp.result.first_name,
        bot_name: resp.result.username,
        can_join_groups: resp.result.can_join_groups,
        can_read_all_group_messages: resp.result.can_read_all_group_messages
      }
    };
  } else {
    return resp;
  }
}

// src/openai.js
async function requestCompletionsFromChatGPT(message, history) {
  const body = {
    model: ENV.CHAT_MODEL,
    ...USER_CONFIG.OPENAI_API_EXTRA_PARAMS,
    messages: [...history || [], { role: "user", content: message }]
  };
  const resp = await fetch(`${ENV.OPENAI_API_DOMAIN}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${ENV.API_KEY}`
    },
    body: JSON.stringify(body)
  }).then((res) => res.json());
  if (resp.error?.message) {
    throw new Error(`OpenAI API Error
> ${resp.error.message}
Params: ${JSON.stringify(body)}`);
  }
  setTimeout(() => updateBotUsage(resp.usage).catch(console.error), 0);
  return resp.choices[0].message.content;
}
async function updateBotUsage(usage) {
  if (!ENV.ENABLE_USAGE_STATISTICS) {
    return;
  }
  let dbValue = JSON.parse(await DATABASE.get(SHARE_CONTEXT.usageKey));
  if (!dbValue) {
    dbValue = {
      tokens: {
        total: 0,
        chats: {}
      }
    };
  }
  dbValue.tokens.total += usage.total_tokens;
  if (!dbValue.tokens.chats[SHARE_CONTEXT.chatId]) {
    dbValue.tokens.chats[SHARE_CONTEXT.chatId] = usage.total_tokens;
  } else {
    dbValue.tokens.chats[SHARE_CONTEXT.chatId] += usage.total_tokens;
  }
  await DATABASE.put(SHARE_CONTEXT.usageKey, JSON.stringify(dbValue));
}

// src/gpt3.js
async function resourceLoader(key, url) {
  try {
    const raw = await DATABASE.get(key);
    if (raw && raw !== "") {
      return raw;
    }
  } catch (e) {
    console.error(e);
  }
  try {
    const bpe = await fetch(url, {
      headers: {
        "User-Agent": CONST.USER_AGENT
      }
    }).then((x) => x.text());
    await DATABASE.put(key, bpe);
    return bpe;
  } catch (e) {
    console.error(e);
  }
  return null;
}
async function gpt3TokensCounter() {
  const repo = "https://raw.githubusercontent.com/tbxark-archive/GPT-3-Encoder/master";
  const encoder = await resourceLoader("encoder_raw_file", `${repo}/encoder.json`).then((x) => JSON.parse(x));
  const bpe_file = await resourceLoader("bpe_raw_file", `${repo}/vocab.bpe`);
  const range = (x, y) => {
    const res = Array.from(Array(y).keys()).slice(x);
    return res;
  };
  const ord = (x) => {
    return x.charCodeAt(0);
  };
  const chr = (x) => {
    return String.fromCharCode(x);
  };
  const textEncoder = new TextEncoder("utf-8");
  const encodeStr = (str) => {
    return Array.from(textEncoder.encode(str)).map((x) => x.toString());
  };
  const dictZip = (x, y) => {
    const result = {};
    x.map((_, i) => {
      result[x[i]] = y[i];
    });
    return result;
  };
  function bytes_to_unicode() {
    const bs = range(ord("!"), ord("~") + 1).concat(range(ord("\xA1"), ord("\xAC") + 1), range(ord("\xAE"), ord("\xFF") + 1));
    let cs = bs.slice();
    let n = 0;
    for (let b = 0; b < 2 ** 8; b++) {
      if (!bs.includes(b)) {
        bs.push(b);
        cs.push(2 ** 8 + n);
        n = n + 1;
      }
    }
    cs = cs.map((x) => chr(x));
    const result = {};
    bs.map((_, i) => {
      result[bs[i]] = cs[i];
    });
    return result;
  }
  function get_pairs(word) {
    const pairs = /* @__PURE__ */ new Set();
    let prev_char = word[0];
    for (let i = 1; i < word.length; i++) {
      const char = word[i];
      pairs.add([prev_char, char]);
      prev_char = char;
    }
    return pairs;
  }
  const pat = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
  const decoder = {};
  Object.keys(encoder).map((x) => {
    decoder[encoder[x]] = x;
  });
  const lines = bpe_file.split("\n");
  const bpe_merges = lines.slice(1, lines.length - 1).map((x) => {
    return x.split(/(\s+)/).filter(function(e) {
      return e.trim().length > 0;
    });
  });
  const byte_encoder = bytes_to_unicode();
  const byte_decoder = {};
  Object.keys(byte_encoder).map((x) => {
    byte_decoder[byte_encoder[x]] = x;
  });
  const bpe_ranks = dictZip(bpe_merges, range(0, bpe_merges.length));
  const cache = /* @__PURE__ */ new Map();
  function bpe(token) {
    if (cache.has(token)) {
      return cache.get(token);
    }
    ``;
    let word = token.split("");
    let pairs = get_pairs(word);
    if (!pairs) {
      return token;
    }
    while (true) {
      const minPairs = {};
      Array.from(pairs).map((pair) => {
        const rank = bpe_ranks[pair];
        minPairs[isNaN(rank) ? 1e11 : rank] = pair;
      });
      const bigram = minPairs[Math.min(...Object.keys(minPairs).map(
        (x) => {
          return parseInt(x);
        }
      ))];
      if (!(bigram in bpe_ranks)) {
        break;
      }
      const first = bigram[0];
      const second = bigram[1];
      let new_word = [];
      let i = 0;
      while (i < word.length) {
        const j = word.indexOf(first, i);
        if (j === -1) {
          new_word = new_word.concat(word.slice(i));
          break;
        }
        new_word = new_word.concat(word.slice(i, j));
        i = j;
        if (word[i] === first && i < word.length - 1 && word[i + 1] === second) {
          new_word.push(first + second);
          i = i + 2;
        } else {
          new_word.push(word[i]);
          i = i + 1;
        }
      }
      word = new_word;
      if (word.length === 1) {
        break;
      } else {
        pairs = get_pairs(word);
      }
    }
    word = word.join(" ");
    cache.set(token, word);
    return word;
  }
  return function tokenCount(text) {
    let tokensCount = 0;
    const matches = Array.from(text.matchAll(pat)).map((x) => x[0]);
    for (let token of matches) {
      token = encodeStr(token).map((x) => {
        return byte_encoder[x];
      }).join("");
      const new_tokens = bpe(token).split(" ").map((x) => encoder[x]);
      tokensCount += new_tokens.length;
    }
    return tokensCount;
  };
}

// src/utils.js
function randomString(length) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let result = "";
  for (let i = length; i > 0; --i)
    result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}
async function historyPassword() {
  let password = await DATABASE.get(CONST.PASSWORD_KEY);
  if (password === null) {
    password = randomString(32);
    await DATABASE.put(CONST.PASSWORD_KEY, password);
  }
  return password;
}
function renderHTML(body) {
  return `
<html>  
  <head>
    <title>ChatGPT-Telegram-Workers</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="ChatGPT-Telegram-Workers">
    <meta name="author" content="TBXark">
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
        font-size: 1rem;
        font-weight: 400;
        line-height: 1.5;
        color: #212529;
        text-align: left;
        background-color: #fff;
      }
      h1 {
        margin-top: 0;
        margin-bottom: 0.5rem;
      }
      p {
        margin-top: 0;
        margin-bottom: 1rem;
      }
      a {
        color: #007bff;
        text-decoration: none;
        background-color: transparent;
      }
      a:hover {
        color: #0056b3;
        text-decoration: underline;
      }
      strong {
        font-weight: bolder;
      }
    </style>
  </head>
  <body>
    ${body}
  </body>
</html>
  `;
}
function errorToString(e) {
  return JSON.stringify({
    message: e.message,
    stack: e.stack
  });
}
function mergeConfig(config, key, value) {
  switch (typeof config[key]) {
    case "number":
      config[key] = Number(value);
      break;
    case "boolean":
      config[key] = value === "true";
      break;
    case "string":
      config[key] = value;
      break;
    case "object":
      const object = JSON.parse(value);
      if (typeof object === "object") {
        config[key] = object;
        break;
      }
      throw new Error("\u4E0D\u652F\u6301\u7684\u914D\u7F6E\u9879\u6216\u6570\u636E\u7C7B\u578B\u9519\u8BEF");
    default:
      throw new Error("\u4E0D\u652F\u6301\u7684\u914D\u7F6E\u9879\u6216\u6570\u636E\u7C7B\u578B\u9519\u8BEF");
  }
}
async function tokensCounter() {
  let counter = (text) => Array.from(text).length;
  try {
    if (ENV.GPT3_TOKENS_COUNT) {
      counter = await gpt3TokensCounter();
    }
  } catch (e) {
    console.error(e);
  }
  return (text) => {
    try {
      return counter(text);
    } catch (e) {
      console.error(e);
      return Array.from(text).length;
    }
  };
}

// src/command.js
var commandAuthCheck = {
  default: function() {
    if (CONST.GROUP_TYPES.includes(SHARE_CONTEXT.chatType)) {
      return ["administrator", "creator"];
    }
    return false;
  },
  shareModeGroup: function() {
    if (CONST.GROUP_TYPES.includes(SHARE_CONTEXT.chatType)) {
      if (!ENV.GROUP_CHAT_BOT_SHARE_MODE) {
        return false;
      }
      return ["administrator", "creator"];
    }
    return false;
  }
};
var commandHandlers = {
  "/help": {
    help: "get help",
    scopes: ["all_private_chats", "all_chat_administrators"],
    fn: commandGetHelp
  },
  "/new": {
    help: "start a new conversation",
    scopes: ["all_private_chats", "all_group_chats", "all_chat_administrators"],
    fn: commandCreateNewChatContext,
    needAuth: commandAuthCheck.shareModeGroup
  },
  "/start": {
    help: "get your ID and start a new conversation",
    scopes: ["all_private_chats", "all_chat_administrators"],
    fn: commandCreateNewChatContext,
    needAuth: commandAuthCheck.default
  },
  // '/img': {
  //   help: '生成一张图片, 命令完整格式为 `/img 图片描述`, 例如`/img 月光下的沙滩`',
  //   scopes: ['all_private_chats', 'all_chat_administrators'],
  //   fn: commandGenerateImg,
  //   needAuth: commandAuthCheck.shareModeGroup,
  // },
  // '/version': {
  //   help: '获取当前版本号, 判断是否需要更新',
  //   scopes: ['all_private_chats', 'all_chat_administrators'],
  //   fn: commandFetchUpdate,
  //   needAuth: commandAuthCheck.default,
  // },
  "/setenv": {
    help: "set user configure /setenv KEY=VALUE",
    scopes: [],
    fn: commandUpdateUserConfig,
    needAuth: commandAuthCheck.shareModeGroup
  },
  "/usage": {
    help: "get bot useage",
    scopes: ["all_private_chats", "all_chat_administrators"],
    fn: commandUsage,
    needAuth: commandAuthCheck.default
  },
  "/system": {
    help: "view system info",
    scopes: ["all_private_chats", "all_chat_administrators"],
    fn: commandSystem,
    needAuth: commandAuthCheck.default
  },
  "/role": {
    help: "set default role",
    scopes: ["all_private_chats"],
    fn: commandUpdateRole,
    needAuth: commandAuthCheck.shareModeGroup
  }
};
async function commandUpdateRole(message, command, subcommand) {
  if (subcommand === "show") {
    const size = Object.getOwnPropertyNames(USER_DEFINE.ROLE).length;
    if (size === 0) {
      return sendMessageToTelegram("not defind any role");
    }
    let showMsg = `definded roles(${size}):
`;
    for (const role2 in USER_DEFINE.ROLE) {
      if (USER_DEFINE.ROLE.hasOwnProperty(role2)) {
        showMsg += `~${role2}:
<pre>`;
        showMsg += JSON.stringify(USER_DEFINE.ROLE[role2]) + "\n";
        showMsg += "</pre>";
      }
    }
    CURRENT_CHAT_CONTEXT.parse_mode = "HTML";
    return sendMessageToTelegram(showMsg);
  }
  const helpMsg = "Command Error: correct command :  `/role command`\nsupported `command`:\n`/role show` show diy role.\n`/role role names del` delete role.\n`/role role name KEY=VALUE` set role.\n default role:\n  `SYSTEM_INIT_MESSAGE`:init info \n  `OPENAI_API_EXTRA_PARAMS`:OpenAI API extra parms,must be JSON";
  const kv = subcommand.indexOf(" ");
  if (kv === -1) {
    return sendMessageToTelegram(helpMsg);
  }
  const role = subcommand.slice(0, kv);
  const settings = subcommand.slice(kv + 1).trim();
  const skv = settings.indexOf("=");
  if (skv === -1) {
    if (settings === "del") {
      try {
        if (USER_DEFINE.ROLE[role]) {
          delete USER_DEFINE.ROLE[role];
          await DATABASE.put(
            SHARE_CONTEXT.configStoreKey,
            JSON.stringify(Object.assign(USER_CONFIG, { USER_DEFINE }))
          );
          return sendMessageToTelegram("delete role success");
        }
      } catch (e) {
        return sendMessageToTelegram(`delete role error : \`${e.message}\``);
      }
    }
    return sendMessageToTelegram(helpMsg);
  }
  const key = settings.slice(0, skv);
  const value = settings.slice(skv + 1);
  if (!USER_DEFINE.ROLE[role]) {
    USER_DEFINE.ROLE[role] = {
      // 系统初始化消息
      SYSTEM_INIT_MESSAGE: ENV.SYSTEM_INIT_MESSAGE,
      // OpenAI API 额外参数
      OPENAI_API_EXTRA_PARAMS: {}
    };
  }
  try {
    mergeConfig(USER_DEFINE.ROLE[role], key, value);
    await DATABASE.put(
      SHARE_CONTEXT.configStoreKey,
      JSON.stringify(Object.assign(USER_CONFIG, { USER_DEFINE }))
    );
    return sendMessageToTelegram("update config success");
  } catch (e) {
    return sendMessageToTelegram(`config error: \`${e.message}\``);
  }
}
async function commandGetHelp(message, command, subcommand) {
  const helpMsg = "supported command:\n" + Object.keys(commandHandlers).map((key) => `${key}\uFF1A${commandHandlers[key].help}`).join("\n");
  return sendMessageToTelegram(helpMsg);
}
async function commandCreateNewChatContext(message, command, subcommand) {
  try {
    await DATABASE.delete(SHARE_CONTEXT.chatHistoryKey);
    if (command === "/new") {
      return sendMessageToTelegram("A new conversation has started");
    } else {
      if (SHARE_CONTEXT.chatType === "private") {
        return sendMessageToTelegram(
          `A new conversation has started, your ID:(${CURRENT_CHAT_CONTEXT.chat_id})`
        );
      } else {
        return sendMessageToTelegram(
          `A new conversation has started, group ID :(${CURRENT_CHAT_CONTEXT.chat_id})`
        );
      }
    }
  } catch (e) {
    return sendMessageToTelegram(`ERROR: ${e.message}`);
  }
}
async function commandUpdateUserConfig(message, command, subcommand) {
  const kv = subcommand.indexOf("=");
  if (kv === -1) {
    return sendMessageToTelegram(
      "command error: correct command is /setenv KEY=VALUE"
    );
  }
  const key = subcommand.slice(0, kv);
  const value = subcommand.slice(kv + 1);
  try {
    mergeConfig(USER_CONFIG, key, value);
    await DATABASE.put(
      SHARE_CONTEXT.configStoreKey,
      JSON.stringify(USER_CONFIG)
    );
    return sendMessageToTelegram("update success");
  } catch (e) {
    return sendMessageToTelegram(`error: ${e.message}`);
  }
}
async function commandUsage() {
  if (!ENV.ENABLE_USAGE_STATISTICS) {
    return sendMessageToTelegram("The current robot does not enable usage statistics");
  }
  const usage = JSON.parse(await DATABASE.get(SHARE_CONTEXT.usageKey));
  let text = "\u{1F4CA} Current robot usage\n\nTokens:\n";
  if (usage?.tokens) {
    const { tokens } = usage;
    const sortedChats = Object.keys(tokens.chats || {}).sort((a, b) => tokens.chats[b] - tokens.chats[a]);
    text += `- total usage:${tokens.total || 0} tokens
- chat usage:`;
    for (let i = 0; i < Math.min(sortedChats.length, 30); i++) {
      text += `
  - ${sortedChats[i]}: ${tokens.chats[sortedChats[i]]} tokens`;
    }
    if (sortedChats.length === 0) {
      text += "0 tokens";
    } else if (sortedChats.length > 30) {
      text += "\n  ...";
    }
  } else {
    text += "- No usage yet";
  }
  return sendMessageToTelegram(text);
}
async function commandSystem(message) {
  let msg = "system info:\n";
  msg += "OpenAI model:" + ENV.CHAT_MODEL + "\n";
  if (ENV.DEBUG_MODE) {
    msg += "<pre>";
    msg += `USER_CONFIG: 
${JSON.stringify(USER_CONFIG, null, 2)}
`;
    if (ENV.DEV_MODE) {
      const shareCtx = { ...SHARE_CONTEXT };
      shareCtx.currentBotToken = "ENPYPTED";
      msg += `CHAT_CONTEXT: 
${JSON.stringify(CURRENT_CHAT_CONTEXT, null, 2)}
`;
      msg += `SHARE_CONTEXT: 
${JSON.stringify(shareCtx, null, 2)}
`;
    }
    msg += "</pre>";
  }
  CURRENT_CHAT_CONTEXT.parse_mode = "HTML";
  return sendMessageToTelegram(msg);
}
async function commandEcho(message) {
  let msg = "<pre>";
  msg += JSON.stringify({ message }, null, 2);
  msg += "</pre>";
  CURRENT_CHAT_CONTEXT.parse_mode = "HTML";
  return sendMessageToTelegram(msg);
}
async function handleCommandMessage(message) {
  if (ENV.DEV_MODE) {
    commandHandlers["/echo"] = {
      help: "[DEBUG ONLY]\u56DE\u663E\u6D88\u606F",
      scopes: ["all_private_chats", "all_chat_administrators"],
      fn: commandEcho,
      needAuth: commandAuthCheck.default
    };
  }
  for (const key in commandHandlers) {
    if (message.text === key || message.text.startsWith(key + " ")) {
      const command = commandHandlers[key];
      try {
        if (command.needAuth) {
          const roleList = command.needAuth();
          if (roleList) {
            const chatRole = await getChatRole(SHARE_CONTEXT.speakerId);
            if (chatRole === null) {
              return sendMessageToTelegram("Authentication failed");
            }
            if (!roleList.includes(chatRole)) {
              return sendMessageToTelegram(`permissions error,need${roleList.join(",")},current:${chatRole}`);
            }
          }
        }
      } catch (e) {
        return sendMessageToTelegram(`Authentication failed:` + e.message);
      }
      const subcommand = message.text.substring(key.length).trim();
      try {
        return await command.fn(message, key, subcommand);
      } catch (e) {
        return sendMessageToTelegram(`command error: ${e.message}`);
      }
    }
  }
  return null;
}
async function bindCommandForTelegram(token) {
  const scopeCommandMap = {
    all_private_chats: [],
    all_group_chats: [],
    all_chat_administrators: []
  };
  for (const key in commandHandlers) {
    if (ENV.HIDE_COMMAND_BUTTONS.includes(key)) {
      continue;
    }
    if (commandHandlers.hasOwnProperty(key) && commandHandlers[key].scopes) {
      for (const scope of commandHandlers[key].scopes) {
        if (!scopeCommandMap[scope]) {
          scopeCommandMap[scope] = [];
        }
        scopeCommandMap[scope].push(key);
      }
    }
  }
  const result = {};
  for (const scope in scopeCommandMap) {
    result[scope] = await fetch(
      `https://api.telegram.org/bot${token}/setMyCommands`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          commands: scopeCommandMap[scope].map((command) => ({
            command,
            description: commandHandlers[command].help
          })),
          scope: {
            type: scope
          }
        })
      }
    ).then((res) => res.json());
  }
  return { ok: true, result };
}
function commandsDocument() {
  return Object.keys(commandHandlers).map((key) => {
    const command = commandHandlers[key];
    return {
      command: key,
      description: command.help
    };
  });
}

// src/message.js
async function msgInitChatContext(message) {
  try {
    await initContext(message);
  } catch (e) {
    return new Response(errorToString(e), { status: 200 });
  }
  return null;
}
async function msgSaveLastMessage(message) {
  if (ENV.DEBUG_MODE) {
    const lastMessageKey = `last_message:${SHARE_CONTEXT.chatHistoryKey}`;
    await DATABASE.put(lastMessageKey, JSON.stringify(message));
  }
  return null;
}
async function msgCheckEnvIsReady(message) {
  if (!ENV.API_KEY) {
    return sendMessageToTelegram("OpenAI API Key not set");
  }
  if (!DATABASE) {
    return sendMessageToTelegram("DATABASE not set");
  }
  return null;
}
async function msgFilterWhiteList(message) {
  if (ENV.I_AM_A_GENEROUS_PERSON || !ENV.GROUP_WL_ENABLE && !ENV.CHAT_WL_ENABLE) {
    return null;
  }
  if (SHARE_CONTEXT.chatType === "private") {
    if (ENV.CHAT_WL_ENABLE && !ENV.CHAT_WHITE_LIST.includes(`${CURRENT_CHAT_CONTEXT.chat_id}`)) {
      return sendMessageToTelegram(
        `You do not have permission to do, please contact ${ENV.ADMIN_CONTECT}to add your ID(${CURRENT_CHAT_CONTEXT.chat_id})to the white list`
      );
    }
    return null;
  }
  if (CONST.GROUP_TYPES.includes(SHARE_CONTEXT.chatType)) {
    if (!ENV.GROUP_CHAT_BOT_ENABLE) {
      return new Response("ID SUPPORT", { status: 401 });
    }
    if (ENV.GROUP_WL_ENABLE && !ENV.CHAT_GROUP_WHITE_LIST.includes(`${CURRENT_CHAT_CONTEXT.chat_id}`)) {
      return sendMessageToTelegram(
        `No permission, please contact ${ENV.ADMIN_CONTECT}to add group ID(${CURRENT_CHAT_CONTEXT.chat_id})to the white list`
      );
    }
    return null;
  }
  return sendMessageToTelegram(
    `This type of chat(${SHARE_CONTEXT.chatType}) is not supported yet`
  );
}
async function msgFilterNonTextMessage(message) {
  if (!message.text) {
    return sendMessageToTelegram("Not support");
  }
  return null;
}
async function msgHandleGroupMessage(message) {
  if (!message.text) {
    return new Response("NON TEXT MESSAGE", { status: 200 });
  }
  const botName = SHARE_CONTEXT.currentBotName;
  if (botName) {
    let mentioned = false;
    if (message.reply_to_message) {
      if (message.reply_to_message.from.username === botName) {
        mentioned = true;
      }
    }
    if (message.entities) {
      let content = "";
      let offset = 0;
      message.entities.forEach((entity) => {
        switch (entity.type) {
          case "bot_command":
            if (!mentioned) {
              const mention = message.text.substring(
                entity.offset,
                entity.offset + entity.length
              );
              if (mention.endsWith(botName)) {
                mentioned = true;
              }
              const cmd = mention.replaceAll("@" + botName, "").replaceAll(botName).trim();
              content += cmd;
              offset = entity.offset + entity.length;
            }
            break;
          case "mention":
          case "text_mention":
            if (!mentioned) {
              const mention = message.text.substring(
                entity.offset,
                entity.offset + entity.length
              );
              if (mention === botName || mention === "@" + botName) {
                mentioned = true;
              }
            }
            content += message.text.substring(offset, entity.offset);
            offset = entity.offset + entity.length;
            break;
        }
      });
      content += message.text.substring(offset, message.text.length);
      message.text = content.trim();
    }
    if (!mentioned) {
      return new Response("NOT MENTIONED", { status: 200 });
    } else {
      return null;
    }
  }
  return new Response("NOT SET BOTNAME", { status: 200 });
  ;
}
async function msgHandleCommand(message) {
  return await handleCommandMessage(message);
}
async function msgHandleRole(message) {
  if (!message.text.startsWith("~")) {
    return null;
  }
  message.text = message.text.slice(1);
  const kv = message.text.indexOf(" ");
  if (kv === -1) {
    return null;
  }
  const role = message.text.slice(0, kv);
  const msg = message.text.slice(kv + 1).trim();
  if (USER_DEFINE.ROLE.hasOwnProperty(role)) {
    SHARE_CONTEXT.ROLE = role;
    message.text = msg;
    const roleConfig = USER_DEFINE.ROLE[role];
    for (const key in roleConfig) {
      if (USER_CONFIG.hasOwnProperty(key) && typeof USER_CONFIG[key] === typeof roleConfig[key]) {
        USER_CONFIG[key] = roleConfig[key];
      }
    }
  }
}
async function msgChatWithOpenAI(message) {
  try {
    console.log("\u63D0\u95EE\u6D88\u606F:" + message.text || "");
    const historyDisable = ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH <= 0;
    setTimeout(() => sendChatActionToTelegram("typing").catch(console.error), 0);
    const historyKey = SHARE_CONTEXT.chatHistoryKey;
    const { real: history, original } = await loadHistory(historyKey);
    const answer = await requestCompletionsFromChatGPT(message.text, history);
    if (!historyDisable) {
      original.push({ role: "user", content: message.text || "", cosplay: SHARE_CONTEXT.ROLE || "" });
      original.push({ role: "assistant", content: answer, cosplay: SHARE_CONTEXT.ROLE || "" });
      await DATABASE.put(historyKey, JSON.stringify(original)).catch(console.error);
    }
    return sendMessageToTelegram(answer);
  } catch (e) {
    return sendMessageToTelegram(`ERROR:CHAT: ${e.message}`);
  }
}
async function msgProcessByChatType(message) {
  const handlerMap = {
    "private": [
      msgFilterWhiteList,
      msgFilterNonTextMessage,
      msgHandleCommand,
      msgHandleRole
    ],
    "group": [
      msgHandleGroupMessage,
      msgFilterWhiteList,
      msgHandleCommand,
      msgHandleRole
    ],
    "supergroup": [
      msgHandleGroupMessage,
      msgFilterWhiteList,
      msgHandleCommand,
      msgHandleRole
    ]
  };
  if (!handlerMap.hasOwnProperty(SHARE_CONTEXT.chatType)) {
    return sendMessageToTelegram(
      `Not support(${SHARE_CONTEXT.chatType})`
    );
  }
  const handlers = handlerMap[SHARE_CONTEXT.chatType];
  for (const handler of handlers) {
    try {
      const result = await handler(message);
      if (result && result instanceof Response) {
        return result;
      }
    } catch (e) {
      console.error(e);
      return sendMessageToTelegram(
        `Handle (${SHARE_CONTEXT.chatType}) error`
      );
    }
  }
  return null;
}
async function loadMessage(request) {
  const raw = await request.json();
  console.log(JSON.stringify(raw));
  if (ENV.DEV_MODE) {
    setTimeout(() => {
      DATABASE.put(`log:${(/* @__PURE__ */ new Date()).toISOString()}`, JSON.stringify(raw), { expirationTtl: 600 }).catch(console.error);
    });
  }
  if (raw.edited_message) {
    raw.message = raw.edited_message;
    SHARE_CONTEXT.editChat = true;
  }
  if (raw.message) {
    return raw.message;
  } else {
    throw new Error("Invalid message");
  }
}
async function loadHistory(key) {
  const initMessage = { role: "system", content: USER_CONFIG.SYSTEM_INIT_MESSAGE };
  const historyDisable = ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH <= 0;
  if (historyDisable) {
    return { real: [initMessage], original: [initMessage] };
  }
  let history = [];
  try {
    history = JSON.parse(await DATABASE.get(key));
  } catch (e) {
    console.error(e);
  }
  if (!history || !Array.isArray(history)) {
    history = [];
  }
  let original = JSON.parse(JSON.stringify(history));
  if (SHARE_CONTEXT.ROLE) {
    history = history.filter((chat) => SHARE_CONTEXT.ROLE === chat.cosplay);
  }
  history.forEach((item) => {
    delete item.cosplay;
  });
  const counter = await tokensCounter();
  const trimHistory = (list, initLength, maxLength, maxToken) => {
    if (list.length > maxLength) {
      list = list.splice(list.length - maxLength);
    }
    let tokenLength = initLength;
    for (let i = list.length - 1; i >= 0; i--) {
      const historyItem = list[i];
      let length = 0;
      if (historyItem.content) {
        length = counter(historyItem.content);
      } else {
        historyItem.content = "";
      }
      tokenLength += length;
      if (tokenLength > maxToken) {
        list = list.splice(i + 1);
        break;
      }
    }
    return list;
  };
  if (ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH > 0) {
    const initLength = counter(initMessage.content);
    const roleCount = Math.max(Object.keys(USER_DEFINE.ROLE).length, 1);
    history = trimHistory(history, initLength, ENV.MAX_HISTORY_LENGTH, ENV.MAX_TOKEN_LENGTH);
    original = trimHistory(original, initLength, ENV.MAX_HISTORY_LENGTH * roleCount, ENV.MAX_TOKEN_LENGTH * roleCount);
  }
  switch (history.length > 0 ? history[0].role : "") {
    case "assistant":
    case "system":
      history[0] = initMessage;
      break;
    default:
      history.unshift(initMessage);
  }
  if (ENV.SYSTEM_INIT_MESSAGE_ROLE !== "system" && history.length > 0 && history[0].role === "system") {
    history[0].role = ENV.SYSTEM_INIT_MESSAGE_ROLE;
  }
  return { real: history, original };
}
async function handleMessage(request) {
  initTelegramContext(request);
  const message = await loadMessage(request);
  const handlers = [
    msgInitChatContext,
    // 初始化聊天上下文: 生成chat_id, reply_to_message_id(群组消息), SHARE_CONTEXT
    msgSaveLastMessage,
    // 保存最后一条消息
    msgCheckEnvIsReady,
    // 检查环境是否准备好: API_KEY, DATABASE
    msgProcessByChatType,
    // 根据类型对消息进一步处理
    msgChatWithOpenAI
    // 与OpenAI聊天
  ];
  for (const handler of handlers) {
    try {
      const result = await handler(message);
      if (result && result instanceof Response) {
        return result;
      }
    } catch (e) {
      console.error(e);
      return new Response(errorToString(e), { status: 500 });
    }
  }
  return null;
}

// src/router.js
var helpLink = "https://github.com/TBXark/ChatGPT-Telegram-Workers/blob/master/DEPLOY.md";
var issueLink = "https://github.com/TBXark/ChatGPT-Telegram-Workers/issues";
var initLink = "./init";
var footer = `
<br/>
<p>For more information, please visit <a href="${helpLink}">${helpLink}</a></p>
<p>If you have any questions, please visit <a href="${issueLink}">${issueLink}</a></p>
`;
function buildKeyNotFoundHTML(key) {
  return `<p style="color: red">Please set the <strong>${key}</strong> environment variable in Cloudflare Workers.</p> `;
}
async function bindWebHookAction(request) {
  const result = [];
  const domain = new URL(request.url).host;
  for (const token of ENV.TELEGRAM_AVAILABLE_TOKENS) {
    const url = `https://${domain}/telegram/${token.trim()}/webhook`;
    const id = token.split(":")[0];
    result[id] = {
      webhook: await bindTelegramWebHook(token, url).catch((e) => errorToString(e)),
      command: await bindCommandForTelegram(token).catch((e) => errorToString(e))
    };
  }
  const HTML = renderHTML(`
    <h1>ChatGPT-Telegram-Workers</h1>
    <h2>${domain}</h2>
    ${ENV.TELEGRAM_AVAILABLE_TOKENS.length === 0 ? buildKeyNotFoundHTML("TELEGRAM_AVAILABLE_TOKENS") : ""}
    ${Object.keys(result).map((id) => `
        <br/>
        <h4>Bot ID: ${id}</h4>
        <p style="color: ${result[id].webhook.ok ? "green" : "red"}">Webhook: ${JSON.stringify(result[id].webhook)}</p>
        <p style="color: ${result[id].command.ok ? "green" : "red"}">Command: ${JSON.stringify(result[id].command)}</p>
        `).join("")}
      ${footer}
    `);
  return new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}
async function loadChatHistory(request) {
  const password = await historyPassword();
  const { pathname } = new URL(request.url);
  const historyKey = pathname.match(/^\/telegram\/(.+)\/history/)[1];
  const params = new URL(request.url).searchParams;
  const passwordParam = params.get("password");
  if (passwordParam !== password) {
    return new Response("Password Error", { status: 401 });
  }
  const history = JSON.parse(await DATABASE.get(historyKey));
  const HTML = renderHTML(`
        <div id="history" style="width: 100%; height: 100%; overflow: auto; padding: 10px;">
            ${history.map((item) => `
                <div style="margin-bottom: 10px;">
                    <hp style="font-size: 16px; color: #999; margin-bottom: 5px;">${item.role}:</hp>
                    <p style="font-size: 12px; color: #333;">${item.content}</p>
                </div>
            `).join("")}
        </div>
  `);
  return new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}
async function telegramWebhook(request) {
  const resp = await handleMessage(request);
  return resp || new Response("NOT HANDLED", { status: 200 });
}
async function defaultIndexAction() {
  const HTML = renderHTML(`
    <h1>ChatGPT-Telegram-Workers</h1>
    <br/>
    <p>Deployed Successfully!</p>
    <p> Version (ts:${ENV.BUILD_TIMESTAMP},sha:${ENV.BUILD_VERSION})</p>
    <br/>
    <p>You must <strong><a href="${initLink}"> >>>>> click here <<<<< </a></strong> to bind the webhook.</p>
    <br/>
    ${ENV.API_KEY ? "" : buildKeyNotFoundHTML("API_KEY")}
    <p>After binding the webhook, you can use the following commands to control the bot:</p>
    ${commandsDocument().map((item) => `<p><strong>${item.command}</strong> - ${item.description}</p>`).join("")}
    <br/>
    <p>You can get bot information by visiting the following URL:</p>
    <p><strong>/telegram/:token/bot</strong> - Get bot information</p>
    ${footer}
  `);
  return new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}
async function gpt3TokenTest(request) {
  const text = new URL(request.url).searchParams.get("text") || "Hello World";
  const counter = await gpt3TokensCounter();
  const HTML = renderHTML(`
    <h1>ChatGPT-Telegram-Workers</h1>
    <br/>
    <p>Token Counter:</p>
    <p>source text: ${text}</p>
    <p>token count: ${counter(text)}</p>
    <br/>
    `);
  return new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}
async function loadBotInfo() {
  const result = [];
  for (const token of ENV.TELEGRAM_AVAILABLE_TOKENS) {
    const id = token.split(":")[0];
    result[id] = await getBot(token);
  }
  const HTML = renderHTML(`
    <h1>ChatGPT-Telegram-Workers</h1>
    <br/>
    <h4>Environment About Bot</h4>
    <p><strong>GROUP_CHAT_BOT_ENABLE:</strong> ${ENV.GROUP_CHAT_BOT_ENABLE}</p>
    <p><strong>GROUP_CHAT_BOT_SHARE_MODE:</strong> ${ENV.GROUP_CHAT_BOT_SHARE_MODE}</p>
    <p><strong>TELEGRAM_BOT_NAME:</strong> ${ENV.TELEGRAM_BOT_NAME.join(",")}</p>
    ${Object.keys(result).map((id) => `
            <br/>
            <h4>Bot ID: ${id}</h4>
            <p style="color: ${result[id].ok ? "green" : "red"}">${JSON.stringify(result[id])}</p>
            `).join("")}
    ${footer}
  `);
  return new Response(HTML, { status: 200, headers: { "Content-Type": "text/html" } });
}
async function handleRequest(request) {
  const { pathname } = new URL(request.url);
  if (pathname === `/`) {
    return defaultIndexAction();
  }
  if (pathname.startsWith(`/init`)) {
    return bindWebHookAction(request);
  }
  if (pathname.startsWith(`/gpt3/tokens/test`)) {
    return gpt3TokenTest(request);
  }
  if (pathname.startsWith(`/telegram`) && pathname.endsWith(`/history`)) {
    return loadChatHistory(request);
  }
  if (pathname.startsWith(`/telegram`) && pathname.endsWith(`/webhook`)) {
    try {
      const resp = await telegramWebhook(request);
      if (resp.status === 200) {
        return resp;
      } else {
        return new Response(resp.body, { status: 200, headers: {
          "Original-Status": resp.status,
          ...resp.headers
        } });
      }
    } catch (e) {
      console.error(e);
      return new Response(errorToString(e), { status: 200 });
    }
  }
  if (pathname.startsWith(`/telegram`) && pathname.endsWith(`/bot`)) {
    return loadBotInfo(request);
  }
  return null;
}

// main.js
var main_default = {
  async fetch(request, env) {
    try {
      initEnv(env);
      const resp = await handleRequest(request);
      return resp || new Response("NOTFOUND", { status: 404 });
    } catch (e) {
      console.error(e);
      return new Response(errorToString(e), { status: 500 });
    }
  }
};
export {
  main_default as default
};
