import { readCompletion } from './chat-stream.js';

const $ = id => document.getElementById(id);
const input = $('chat-input'), sendButton = $('chat-send');
const scroll = $('chat-scroll'), messages = $('chat-messages');
let apiBase = '', ready = false, busy = false, history = [], retryTurn = null, active = null;

function showPane(name, focus = false) {
  for (const pane of ['chat', 'details']) {
    const selected = pane === name;
    $(pane + '-tab').setAttribute('aria-selected', String(selected));
    $(pane + '-tab').tabIndex = selected ? 0 : -1;
    $(pane + '-pane').hidden = !selected;
  }
  if (focus) $(name + '-tab').focus();
}
for (const name of ['chat', 'details']) {
  $(name + '-tab').addEventListener('click', () => showPane(name));
  $(name + '-tab').addEventListener('keydown', e => {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
      e.preventDefault();
      showPane(e.key === 'Home' ? 'chat' : e.key === 'End' ? 'details' : name === 'chat' ? 'details' : 'chat', true);
    }
  });
}
$('chat-context-part').addEventListener('click', () => showPane('details', true));
function updateContext() {
  $('chat-context-part').textContent = $('selection-label').textContent || '尚未选择零件';
}
new MutationObserver(updateContext).observe($('selection-label'), { childList: true, subtree: true, characterData: true });
updateContext();

function notice(text, retry = false) {
  $('chat-notice-text').textContent = text;
  $('chat-retry').hidden = !retry;
}
function updateButtons() {
  sendButton.disabled = !ready || busy || !input.value.trim();
  sendButton.hidden = busy;
  $('chat-stop').hidden = !busy;
  input.readOnly = busy;
  messages.setAttribute('aria-busy', String(busy));
}
function scrollBottom() { scroll.scrollTop = scroll.scrollHeight; }
function addMessage(role, content, partName = '') {
  $('chat-welcome').hidden = true;
  const item = document.createElement('article');
  item.className = 'chat-message';
  item.dataset.role = role;
  const label = document.createElement('p');
  label.className = 'chat-message-label';
  label.textContent = role === 'user' ? '你' + (partName ? ' · ' + partName : '') : 'DeepSeek';
  const body = document.createElement('div');
  body.className = 'chat-message-body';
  body.textContent = content;
  item.append(label, body);
  messages.append(item);
  scrollBottom();
  return { item, body };
}

async function requestReply(turn, userAlreadyVisible = false) {
  if (!ready || busy) return;
  if (!userAlreadyVisible) addMessage('user', turn.content, turn.partName);
  retryTurn = turn;
  busy = true;
  notice('正在组织回答…');
  updateButtons();
  const reply = addMessage('assistant', '正在思考…');
  reply.item.dataset.pending = 'true';
  const controller = new AbortController();
  active = controller;
  let timedOut = false, text = '';
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 75000);
  try {
    const headers = { 'Content-Type': 'application/json' };
    const accessCode = $('chat-access-code').value.trim();
    if (accessCode) headers['X-Chat-Token'] = accessCode;
    const payload = [...history.slice(-20), turn].map(({ role, content, selectedPartId }) => ({ role, content, selectedPartId }));
    const response = await fetch(apiBase + '/chat', {
      method: 'POST', headers, credentials: 'omit', signal: controller.signal,
      body: JSON.stringify({ messages: payload })
    });
    if (!response.ok) {
      let error;
      try { error = await response.json(); } catch {}
      if (response.status === 401 && error?.code === 'ACCESS_DENIED') {
        $('chat-access').hidden = false;
        $('chat-access').open = true;
        $('chat-access-code').focus();
      }
      throw new Error(error?.message || '聊天服务暂时不可用，请稍后重试。');
    }
    if (!response.headers.get('content-type')?.includes('text/event-stream')) {
      throw new Error('聊天服务返回格式异常，请检查接入配置。');
    }
    const result = await readCompletion(response.body, delta => {
      if (active !== controller) return;
      const nearBottom = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 90;
      text += delta;
      reply.body.textContent = text;
      reply.item.dataset.pending = 'false';
      if (nearBottom) scrollBottom();
    });
    if (active !== controller) return;
    history.push({ role: 'user', content: turn.content, selectedPartId: turn.selectedPartId }, { role: 'assistant', content: result.answer });
    history = history.slice(-20);
    while (history.length && history.reduce((sum, message) => sum + message.content.length, 0) > 24000) {
      history.splice(0, 2);
    }
    retryTurn = null;
    notice(result.truncated ? '回复达到长度上限，可以继续追问。' : '回复完成，可以继续追问。');
  } catch (error) {
    if (active !== controller) return;
    if (!text) reply.item.remove();
    else {
      reply.item.dataset.pending = 'false';
      reply.item.querySelector('.chat-message-label').textContent = 'DeepSeek · 未完成';
    }
    if (controller.signal.aborted) notice(timedOut ? '等待回复超时，请重试。' : '已停止回复。', true);
    else notice(error instanceof TypeError ? '无法连接聊天服务，请检查网络后重试。' : error.message, true);
  } finally {
    clearTimeout(timer);
    if (active === controller) { active = null; busy = false; updateButtons(); }
  }
}

$('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  const content = input.value.trim();
  if (!content || content.length > 2000 || busy || !ready) return;
  const state = window.__gearLab?.getState();
  const turn = { role: 'user', content, selectedPartId: state?.selected || null,
    partName: state?.selected ? $('selection-label').textContent : '' };
  input.value = '';
  void requestReply(turn);
});
input.addEventListener('input', updateButtons);
input.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
    e.preventDefault();
    $('chat-form').requestSubmit();
  }
});
$('chat-stop').addEventListener('click', () => active?.abort());
$('chat-retry').addEventListener('click', () => {
  if (retryTurn) void requestReply(retryTurn, true);
});
$('chat-reset').addEventListener('click', () => {
  active?.abort(); active = null; busy = false; history = []; retryTurn = null;
  messages.replaceChildren(); $('chat-welcome').hidden = false;
  scroll.scrollTop = 0;
  input.value = ''; notice(ready ? '已开始新对话。' : 'AI 服务接通后即可开始对话。');
  updateButtons(); input.focus();
});
document.querySelectorAll('.chat-suggestions button').forEach(button => button.addEventListener('click', () => {
  if (busy) return;
  input.value = button.textContent; updateButtons(); input.focus();
}));

async function connect() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const configResponse = await fetch('./chat-config.json', { cache: 'no-store', signal: controller.signal });
    if (!configResponse.ok) throw new Error('聊天配置暂不可用。');
    const config = await configResponse.json();
    if (!config.apiBase) {
      $('chat-connection').textContent = 'DeepSeek · 待接通';
      notice('聊天面板已就绪，AI 服务接通后即可发送。');
      return;
    }
    const url = new URL(config.apiBase, location.href);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) {
      throw new Error('聊天服务需要使用安全连接。');
    }
    if (url.username || url.password || url.search || url.hash) throw new Error('聊天服务地址配置有误。');
    apiBase = url.href.replace(/\/$/, '');
    const response = await fetch(apiBase + '/health', { credentials: 'omit', signal: controller.signal });
    if (!response.ok) throw new Error('聊天服务暂不可用。');
    const health = await response.json();
    if (!health.ready) throw new Error('DeepSeek 服务尚未配置完成。');
    ready = true;
    $('chat-access').hidden = !health.requiresAccessCode;
    $('chat-connection').textContent = 'DeepSeek · 服务已连接';
    $('chat-connection').dataset.state = 'ready';
    notice(health.requiresAccessCode ? '输入访问口令后即可开始聊天。' : '');
  } catch (error) {
    $('chat-connection').textContent = 'DeepSeek · 暂未连接';
    notice(error.name === 'AbortError' ? '连接聊天服务超时，请刷新重试。' : error instanceof TypeError ? '无法连接聊天服务，请检查网络后刷新。' : error.message);
  } finally { clearTimeout(timer); updateButtons(); }
}
void connect();
