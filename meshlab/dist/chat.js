import { readCompletion } from './chat-stream.js';
import { initAuth, canChat, currentUser, token, openAuth, setBudget, authUnavailable } from './auth.js';
import { captureTurbineContext } from './turbine/chat-context.mjs';
import { captureBicycleContext } from './bicycle/chat-context.mjs';
import { captureFrictionContext } from './friction/chat-context.mjs';
import { captureSpurContext } from './spur/chat-context.mjs';
import { captureIdlerContext } from './idler/chat-context.mjs';
import { captureBeltContext } from './belt/chat-context.mjs';
import { captureTimingContext } from './timing/chat-context.mjs';
import { captureViceContext } from './vice/chat-context.mjs';
import { captureCatalogContext } from './catalog/chat-context.mjs';
import { captureExperimentContext, createExperimentChatPayload as createChatPayload } from './experiments/chat-context.mjs';

const $ = id => document.getElementById(id);
const input = $('chat-input'), sendButton = $('chat-send');
const scroll = $('chat-scroll'), messages = $('chat-messages');
let apiBase = '', ready = false, busy = false, history = [], retryTurn = null, active = null;
let accountId = null, accountRevision = 0;
let supportsTurbine = false, supportsBicycle = false, supportsFriction = false, supportsSpur = false, supportsIdler = false, supportsBelt = false, supportsTiming = false, supportsVice = false, supportsCatalog = false;
const CATALOG_PENDING = '当前机构AI服务待更新';
const catalogPending = () => Boolean(window.__catalogLab) && !supportsCatalog;

async function refreshBudget() {
  const revision = ++accountRevision;
  if (!ready || !canChat()) return;
  try {
    const response = await fetch(apiBase + '/account', { headers: { Authorization: 'Bearer ' + await token() }, credentials: 'omit', signal: AbortSignal.timeout(10000) });
    if (response.ok) {
      const summary = await response.json();
      if (revision === accountRevision) setBudget(summary);
    }
  } catch { /* The server still enforces the budget when the summary cannot load. */ }
}

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
  const experiment = captureExperimentContext(window.__experimentLab?.getState());
  const catalog = captureCatalogContext(window.__catalogLab?.getState());
  const viceState = window.__viceLab?.getState();
  const vice = viceState && captureViceContext(viceState);
  const timingState = window.__timingLab?.getState();
  const timing = timingState && captureTimingContext(timingState);
  const beltState = window.__beltLab?.getState();
  const belt = beltState && captureBeltContext(beltState);
  const idlerState = window.__idlerLab?.getState();
  const idler = idlerState && captureIdlerContext(idlerState);
  const spurState = window.__spurLab?.getState();
  const spur = spurState && captureSpurContext(spurState);
  const frictionState = window.__frictionLab?.getState();
  const friction = frictionState && captureFrictionContext(frictionState);
  const bicycleState = window.__bicycleLab?.getState();
  const bicycle = bicycleState && captureBicycleContext(bicycleState);
  const state = window.__turbineLab?.getState();
  const context = state && captureTurbineContext(state);
  $('chat-context-part').textContent = experiment?.selectedPart?.name || catalog?.selectedPart?.name || vice?.selectedPart?.name || timing?.selectedPart?.name || belt?.selectedPart?.name || idler?.selectedPart?.name || spur?.selectedPart?.name || friction?.selectedPart?.name || bicycle?.selectedPart?.name || context?.selectedPart?.name || $('selection-label')?.textContent || '尚未选择零件';
  const model = document.querySelector('.chat-context > span');
  if (experiment && model) model.textContent = experiment.title + (experiment.valid ? '' : ' · 参数待修正');
  else if (catalog && model) model.textContent = catalog.title + ' · ' + (catalog.playing?'播放中':'已暂停');
  else if (vice && model) model.textContent = `台虎钳 · 开口 ${vice.runtime?.jawOpening==null?'—':Number(vice.runtime.jawOpening.toFixed(1))} mm · 导程 ${vice.parameters.lead ?? '—'} mm`;
  else if (timing && model) model.textContent = `同步带 · ${timing.parameters.driverTeeth ?? '—'} / ${timing.parameters.drivenTeeth ?? '—'} 齿 · 节距 5 mm`;
  else if (belt && model) model.textContent = `平带 · ${belt.parameters.crossed===true?'交叉带':belt.parameters.crossed===false?'开口带':'模式待确认'} · ${belt.parameters.driverDiameter ?? '—'} / ${belt.parameters.drivenDiameter ?? '—'} mm`;
  else if (idler && model) model.textContent = `齿轮列 · ${idler.parameters.useIdler===true?'有惰轮':idler.parameters.useIdler===false?'直接啮合':'模式待确认'} · ${idler.parameters.driverTeeth ?? '—'} / ${idler.parameters.drivenTeeth ?? '—'} 齿`;
  else if (spur && model) model.textContent = `直齿齿轮 · ${spur.parameters.driverTeeth ?? '—'} / ${spur.parameters.drivenTeeth ?? '—'} 齿 · m${spur.parameters.module ?? '—'}`;
  else if (friction && model) model.textContent = `摩擦轮 · ${friction.parameters.driverDiameter ?? '—'} / ${friction.parameters.drivenDiameter ?? '—'} mm · ${friction.parameters.inputRPM ?? '—'} rpm`;
  else if (bicycle && model) model.textContent = `自行车 · ${bicycle.parameters.frontTeeth ?? '—'} / ${bicycle.parameters.rearTeeth ?? '—'} 齿 · ${bicycle.parameters.cadence ?? '—'} rpm`;
  else if (context && model) model.textContent = `汽轮机 · ${context.parameters.stages ?? '—'} 级 · ${context.parameters.blades ?? '—'} 片/排`;
  updateButtons();
}
if ($('selection-label')) new MutationObserver(updateContext).observe($('selection-label'), { childList: true, subtree: true, characterData: true });
window.addEventListener('turbine:statechange', updateContext);
window.addEventListener('bicycle:statechange', updateContext);
window.addEventListener('friction:statechange', updateContext);
window.addEventListener('spur:statechange', updateContext);
window.addEventListener('idler:statechange', updateContext);
window.addEventListener('belt:statechange', updateContext);
window.addEventListener('timing:statechange', updateContext);
window.addEventListener('vice:statechange', updateContext);
window.addEventListener('catalog:statechange', updateContext);
window.addEventListener('experiment:statechange', updateContext);
updateContext();

function notice(text, retry = false) {
  $('chat-notice-text').textContent = text;
  $('chat-retry').hidden = !retry;
}
function updateButtons() {
  const pending = catalogPending();
  sendButton.disabled = pending || !ready || !canChat() || busy || !input.value.trim();
  sendButton.hidden = busy;
  $('chat-stop').hidden = !busy;
  input.readOnly = busy || pending;
  document.querySelectorAll('.chat-suggestions button').forEach(button => button.disabled = pending);
  if (pending) {
    notice(CATALOG_PENDING);
    if (ready) { $('chat-connection').textContent = 'DeepSeek · ' + CATALOG_PENDING; $('chat-connection').dataset.state = 'pending'; }
  }
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
  if (catalogPending()) { notice(CATALOG_PENDING); updateButtons(); return; }
  if (!canChat()) { openAuth(); return; }
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
    const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token() };
    const payload = createChatPayload([...history.slice(-20), turn], {supportsTurbine,supportsBicycle,supportsFriction,supportsSpur,supportsIdler,supportsBelt,supportsTiming,supportsVice,supportsCatalog});
    const response = await fetch(apiBase + '/chat', {
      method: 'POST', headers, credentials: 'omit', signal: controller.signal,
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      let error;
      try { error = await response.json(); } catch {}
      if (response.status === 401) openAuth();
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
    history.push({ role: 'user', content: turn.content, selectedPartId: turn.selectedPartId, turbineContext: turn.turbineContext, bicycleContext: turn.bicycleContext, frictionContext: turn.frictionContext, spurContext: turn.spurContext, idlerContext: turn.idlerContext, beltContext: turn.beltContext, timingContext: turn.timingContext, viceContext: turn.viceContext, catalogContext: turn.catalogContext, experimentContext: turn.experimentContext }, { role: 'assistant', content: result.answer });
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
    if (active === controller) { active = null; busy = false; updateButtons(); void refreshBudget(); }
  }
}

$('chat-form').addEventListener('submit', e => {
  e.preventDefault();
  if (catalogPending()) { notice(CATALOG_PENDING); updateButtons(); return; }
  const content = input.value.trim();
  if (!content || content.length > 2000 || busy || !ready) return;
  if (!canChat()) { openAuth(); return; }
  const turbineState = window.__turbineLab?.getState();
  const bicycleState = window.__bicycleLab?.getState();
  const frictionState = window.__frictionLab?.getState();
  const spurState = window.__spurLab?.getState();
  const idlerState = window.__idlerLab?.getState();
  const beltState = window.__beltLab?.getState();
  const timingState = window.__timingLab?.getState();
  const viceState = window.__viceLab?.getState();
  const experimentContext = captureExperimentContext(window.__experimentLab?.getState());
  const catalogContext = captureCatalogContext(window.__catalogLab?.getState());
  if ($('geometry-fields') && !turbineState && !bicycleState && !frictionState && !spurState && !idlerState && !beltState && !timingState && !viceState && !catalogContext && !experimentContext) { notice('模型参数尚未就绪，请稍后再试。'); return; }
  const turbineContext = turbineState ? captureTurbineContext(turbineState) : null;
  const bicycleContext = bicycleState ? captureBicycleContext(bicycleState) : null;
  const frictionContext = frictionState ? captureFrictionContext(frictionState) : null;
  const spurContext = spurState ? captureSpurContext(spurState) : null;
  const idlerContext = idlerState ? captureIdlerContext(idlerState) : null;
  const beltContext = beltState ? captureBeltContext(beltState) : null;
  const timingContext = timingState ? captureTimingContext(timingState) : null;
  const viceContext = viceState ? captureViceContext(viceState) : null;
  const state = window.__gearLab?.getState();
  const turn = { role: 'user', content, selectedPartId: state?.selected || null,
    partName: experimentContext?.selectedPart?.name || catalogContext?.selectedPart?.name || viceContext?.selectedPart?.name || timingContext?.selectedPart?.name || beltContext?.selectedPart?.name || idlerContext?.selectedPart?.name || spurContext?.selectedPart?.name || frictionContext?.selectedPart?.name || bicycleContext?.selectedPart?.name || turbineContext?.selectedPart?.name || (state?.selected ? $('selection-label').textContent : ''),
    turbineContext, bicycleContext, frictionContext, spurContext, idlerContext, beltContext, timingContext, viceContext, catalogContext, experimentContext };
  try { createChatPayload([...history.slice(-20), turn], {supportsTurbine,supportsBicycle,supportsFriction,supportsSpur,supportsIdler,supportsBelt,supportsTiming,supportsVice,supportsCatalog}); }
  catch (error) { notice(error.message); return; }
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
    supportsTurbine = health.modelContexts?.includes('turbine') === true;
    supportsBicycle = health.modelContexts?.includes('bicycle') === true;
    supportsFriction = health.modelContexts?.includes('friction') === true;
    supportsSpur = health.modelContexts?.includes('spur') === true;
    supportsIdler = health.modelContexts?.includes('idler') === true;
    supportsBelt = health.modelContexts?.includes('belt') === true;
    supportsTiming = health.modelContexts?.includes('timing') === true;
    supportsVice = health.modelContexts?.includes('vice') === true;
    supportsCatalog = health.modelContexts?.includes('catalog') === true;
    ready = true;
    $('chat-connection').textContent = 'DeepSeek · 服务已连接';
    $('chat-connection').dataset.state = 'ready';
    if (!health.requiresLogin || !config.firebase?.projectId) throw new Error('邮箱登录配置尚未就绪，请稍后刷新。');
    initAuth(config.firebase, user => {
      const nextId = user?.uid || null;
      if (nextId !== accountId) {
        active?.abort(); active = null; busy = false; history = []; retryTurn = null;
        messages.replaceChildren(); $('chat-welcome').hidden = false; scroll.scrollTop = 0;
        input.value = '';
        accountId = nextId;
      }
      accountRevision++;
      notice(canChat() ? '' : user ? '验证邮箱后即可聊天。' : '登录后即可聊天，每账号每天最多 2 元。');
      updateButtons(); void refreshBudget();
    }, health.requiresEmailVerification);
  } catch (error) {
    ready = false; authUnavailable();
    $('chat-connection').textContent = 'DeepSeek · 暂未连接';
    notice(error.name === 'AbortError' ? '连接聊天服务超时，请刷新重试。' : error instanceof TypeError ? '无法连接聊天服务，请检查网络后刷新。' : error.message);
  } finally { clearTimeout(timer); updateButtons(); }
}
void connect();
