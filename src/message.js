import {ENV, DATABASE, CONST} from './env.js';
import {SHARE_CONTEXT, USER_CONFIG, CURRENT_CHAT_CONTEXT, initContext} from './context.js';
import {sendMessageToTelegram, sendChatActionToTelegram, deleteMessageInlineKeyboard} from './telegram.js';
import {requestCompletionsFromChatGPT} from './openai.js';
import {handleCommandMessage} from './command.js';
import {errorToString} from './utils.js';

const MAX_TOKEN_LENGTH = 2048;

// Middleware

// 初始化聊天上下文
async function msgInitChatContext(message, request) {
  try {
    await initContext(message, request);
  } catch (e) {
    return new Response(errorToString(e), {status: 200});
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


// 检查环境变量是否设置
async function msgCheckEnvIsReady(message) {
  if (!ENV.API_KEY) {
    return sendMessageToTelegram('OpenAI API Key 未设置');
  }
  if (!DATABASE) {
    return sendMessageToTelegram('DATABASE 未设置');
  }
  return null;
}

// 过滤非白名单用户
async function msgFilterWhiteList(message) {
  if (ENV.I_AM_A_GENEROUS_PERSON || (!ENV.GROUP_WL_ENABLE && !ENV.CHAT_WL_ENABLE)) {
    return null;
  }
  // 判断私聊消息
  if (SHARE_CONTEXT.chatType==='private') {
    // 白名单判断
    if (ENV.CHAT_WL_ENABLE && !ENV.CHAT_WHITE_LIST.includes(`${CURRENT_CHAT_CONTEXT.chat_id}`)) {
      return sendMessageToTelegram(
          `你没有权限使用这个命令, 请请联系管理员${ENV.ADMIN_CONTECT}添加你的ID(${CURRENT_CHAT_CONTEXT.chat_id})到白名单`,
      );
    }
    return null;
  }

  // 判断群聊消息
  if (CONST.GROUP_TYPES.includes(SHARE_CONTEXT.chatType)) {
    // 未打开群组机器人开关,直接忽略
    if (!ENV.GROUP_CHAT_BOT_ENABLE) {
      return new Response('ID SUPPORT', {status: 401});
    }
    // 白名单判断
    if (ENV.GROUP_WL_ENABLE && !ENV.CHAT_GROUP_WHITE_LIST.includes(`${CURRENT_CHAT_CONTEXT.chat_id}`)) {
      return sendMessageToTelegram(
          `该群未开启聊天权限, 请请联系管理员${ENV.ADMIN_CONTECT}添加群ID(${CURRENT_CHAT_CONTEXT.chat_id})到白名单`,
      );
    }
    return null;
  }
  return sendMessageToTelegram(
      `暂不支持该类型(${SHARE_CONTEXT.chatType})的聊天`,
  );
}

// 过滤非文本消息
async function msgFilterNonTextMessage(message) {
  if (!message.text) {
    return sendMessageToTelegram('暂不支持非文本格式消息');
  }
  return null;
}

// 处理群消息
async function msgHandleGroupMessage(message) {
  // 非文本消息直接忽略
  if (!message.text) {
    return new Response('NON TEXT MESSAGE', {status: 200});
  }
  // 处理群组消息，过滤掉AT部分
  const botName = SHARE_CONTEXT.currentBotName;
  if (botName) {
    let mentioned = false;
    if (SHARE_CONTEXT.fromInlineKeyboard) {
      mentioned = true;
    }
    // Reply消息
    if (message.reply_to_message) {
      if (message.reply_to_message.from.username === botName) {
        mentioned = true;
      }
    }
    if (message.entities) {
      let content = '';
      let offset = 0;
      message.entities.forEach((entity) => {
        switch (entity.type) {
          case 'bot_command':
            if (!mentioned) {
              const mention = message.text.substring(
                  entity.offset,
                  entity.offset + entity.length,
              );
              if (mention.endsWith(botName)) {
                mentioned = true;
              }
              const cmd = mention
                  .replaceAll('@' + botName, '')
                  .replaceAll(botName)
                  .trim();
              content += cmd;
              offset = entity.offset + entity.length;
            }
            break;
          case 'mention':
          case 'text_mention':
            if (!mentioned) {
              const mention = message.text.substring(
                  entity.offset,
                  entity.offset + entity.length,
              );
              if (mention === botName || mention === '@' + botName) {
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
    // 未AT机器人的消息不作处理
    if (!mentioned) {
      return new Response('NOT MENTIONED', {status: 200});
    } else {
      return null;
    }
  }
  return new Response('NOT SET BOTNAME', {status: 200}); ;
}

// 响应命令消息
async function msgHandleCommand(message) {
  return await handleCommandMessage(message);
}

// 聊天
async function msgChatWithOpenAI(message) {
  try {
    console.log('提问消息:'+message.text||'');
    const historyDisable = ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH <= 0;
    setTimeout(() => sendChatActionToTelegram('typing').catch(console.error), 0);
    const historyKey = SHARE_CONTEXT.chatHistoryKey;
    const {real: history, fake: fakeHistory} = await loadHistory(historyKey);
    const answer = await requestCompletionsFromChatGPT(message.text, fakeHistory || history);
    if (!historyDisable) {
      history.push({role: 'user', content: message.text || ''});
      history.push({role: 'assistant', content: answer});
      await DATABASE.put(historyKey, JSON.stringify(history)).catch(console.error);
    }
    if (SHARE_CONTEXT.chatType && ENV.INLINE_KEYBOARD_ENABLE.includes(SHARE_CONTEXT.chatType)) {
      const replyMarkup = { };
      replyMarkup.inline_keyboard = [[
        {
          text: '继续',
          callback_data: `#continue`,
        },
        {
          text: '结束',
          callback_data: `#end`,
        },
      ]];
      CURRENT_CHAT_CONTEXT.reply_markup = replyMarkup;
    }
    return sendMessageToTelegram(answer);
  } catch (e) {
    return sendMessageToTelegram(`ERROR:CHAT: ${e.message}`);
  }
}

// 根据类型对消息进一步处理
export async function msgProcessByChatType(message) {
  const handlerMap = {
    'private': [
      msgFilterWhiteList,
      msgFilterNonTextMessage,
      msgHandleCommand,
    ],
    'group': [
      msgHandleGroupMessage,
      msgFilterWhiteList,
      msgHandleCommand,
    ],
    'supergroup': [
      msgHandleGroupMessage,
      msgFilterWhiteList,
      msgHandleCommand,
    ],
  };
  if (!handlerMap.hasOwnProperty(SHARE_CONTEXT.chatType)) {
    return sendMessageToTelegram(
        `暂不支持该类型(${SHARE_CONTEXT.chatType})的聊天`,
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
          `处理(${SHARE_CONTEXT.chatType})的聊天消息出错`,
      );
    }
  }
  return null;
}

// Loader
async function loadMessage(request) {
  const raw = await request.json();
  console.log(raw);
  if (ENV.DEV_MODE) {
    setTimeout(() => {
      DATABASE.put(`log:${new Date().toISOString()}`, JSON.stringify(raw), {expirationTtl: 600}).catch(console.error);
    });
  }
  if (raw.message) {
    return raw.message;
  } else if (raw.callback_query && raw.callback_query.message) {
    const messageId = raw.callback_query.message?.message_id;
    const chatId = raw.callback_query.message?.chat?.id;
    const data = raw.callback_query.data;
    if (data.startsWith('#continue')) {
      raw.callback_query.message.text = '继续';
    } else if (data.startsWith('#end')) {
      raw.callback_query.message.text = '/new';
    }
    if (messageId && chatId) {
      setTimeout(() => deleteMessageInlineKeyboard(chatId, messageId).catch(console.error), 0);
    }
    SHARE_CONTEXT.fromInlineKeyboard = true;
    return raw.callback_query.message;
  } else {
    throw new Error('Invalid message');
  }
}

// { real: [], fake: [] }
async function loadHistory(key) {
  const initMessage = {role: 'system', content: USER_CONFIG.SYSTEM_INIT_MESSAGE};
  const historyDisable = ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH <= 0;
  if (historyDisable) {
    return {real: [initMessage]};
  }
  let history = [];
  try {
    history = JSON.parse(await DATABASE.get(key));
  } catch (e) {
    console.error(e);
  }
  if (!history || !Array.isArray(history) || history.length === 0) {
    history = [];
  }
  if (ENV.AUTO_TRIM_HISTORY && ENV.MAX_HISTORY_LENGTH > 0) {
    // 历史记录超出长度需要裁剪
    if (history.length > ENV.MAX_HISTORY_LENGTH) {
      history = history.splice(history.length - ENV.MAX_HISTORY_LENGTH);
    }
    // 处理token长度问题
    let tokenLength = Array.from(initMessage.content).length;
    for (let i = history.length - 1; i >= 0; i--) {
      const historyItem = history[i];
      let length = 0;
      if (historyItem.content) {
        length = Array.from(historyItem.content).length;
      } else {
        historyItem.content = '';
      }
      // 如果最大长度超过maxToken,裁剪history
      tokenLength += length;
      if (tokenLength > MAX_TOKEN_LENGTH) {
        history = history.splice(i + 1);
        break;
      }
    }
  }
  switch (history.length > 0 ? history[0].role : '') {
    case 'assistant': // 第一条为机器人，替换成init
    case 'system': // 第一条为system，用新的init替换
      history[0] = initMessage;
      break;
    default:// 默认给第一条插入init
      history.unshift(initMessage);
  }
  if (ENV.SYSTEM_INIT_MESSAGE_ROLE !== 'system' && history.length > 0 && history[0].role === 'system') {
    const fake = [
      ...history,
    ];
    fake[0] = {
      ...fake[0],
      role: ENV.SYSTEM_INIT_MESSAGE_ROLE,
    };
    return {real: history, fake};
  }
  return {real: history};
}

export async function handleMessage(request) {
  const message = await loadMessage(request);

  // 消息处理中间件
  const handlers = [
    msgInitChatContext, // 初始化聊天上下文: 生成chat_id, reply_to_message_id(群组消息), SHARE_CONTEXT
    msgSaveLastMessage, // 保存最后一条消息
    msgCheckEnvIsReady, // 检查环境是否准备好: API_KEY, DATABASE
    msgProcessByChatType, // 根据类型对消息进一步处理
    msgChatWithOpenAI, // 与OpenAI聊天
  ];

  for (const handler of handlers) {
    try {
      const result = await handler(message, request);
      if (result && result instanceof Response) {
        return result;
      }
    } catch (e) {
      return new Response(errorToString(e), {status: 500});
    }
  }
  return null;
}
