import { initializeApp, getAuth, onIdTokenChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendEmailVerification, sendPasswordResetEmail, signOut, reload, getIdToken } from './assets/firebase-auth.js';

const $ = id => document.getElementById(id);
let auth, changed = () => {}, mode = 'login', working = false, resendAfter = 0, requireVerification = true;
export const currentUser = () => auth?.currentUser || null;
export const canChat = () => Boolean(currentUser() && (!requireVerification || currentUser().emailVerified));
export async function token() {
  if (!canChat()) throw new Error(requireVerification ? '请先登录并完成邮箱验证。' : '请先登录账号。');
  return getIdToken(currentUser());
}
const errors = {
  'auth/invalid-credential': '邮箱或密码不正确，请重试。', 'auth/invalid-email': '请输入有效的邮箱地址。',
  'auth/email-already-in-use': '这个邮箱已注册，请切换到登录，或重置密码。',
  'auth/weak-password': '密码强度不足，请使用至少 8 位密码。',
  'auth/too-many-requests': '尝试次数较多，请稍后再试。',
  'auth/network-request-failed': '暂时无法连接邮箱登录服务，请检查网络。',
  'auth/operation-not-allowed': '邮箱登录服务尚未启用，请联系维护者。'
};
function feedback(text) { $('auth-message').textContent = text; }
function showError(error) { feedback(errors[error.code] || error.message || '操作未完成，请稍后重试。'); }
function busy(value) {
  working = value;
  $('auth-dialog').querySelectorAll('button:not(#auth-close),input').forEach(el => { el.disabled = value; });
}
function render() {
  const user = currentUser();
  $('auth-form').hidden = Boolean(user);
  $('auth-switch').hidden = Boolean(user);
  $('auth-verify').hidden = !requireVerification || !user || user.emailVerified;
  $('auth-dialog-logout').hidden = !user;
  $('chat-account-email').textContent = user?.email || '邮箱登录后即可聊天';
  $('chat-login').textContent = user ? canChat() ? '账号' : '验证邮箱' : '登录 / 注册';
  if (!user) $('chat-budget').textContent = '每账号每天 2 元 · 北京时间零点重置';
  else if (!canChat()) $('chat-budget').textContent = '请打开验证邮件，再点击“我已验证”';
  $('auth-title').textContent = user ? canChat() ? '账号已登录' : '验证你的邮箱' : mode === 'login' ? '邮箱登录' : '创建账号';
  $('auth-submit').textContent = mode === 'login' ? '登录' : requireVerification ? '注册并发送验证邮件' : '注册并开始聊天';
  document.querySelector('.auth-intro').textContent = `${requireVerification ? '登录并验证邮箱后' : '注册或登录后即可聊天'}，每个账号每天可使用 2 元 AI 预算，北京时间零点重置。`;
  $('auth-confirm-wrap').hidden = mode !== 'signup';
  $('auth-confirm').required = mode === 'signup';
  $('auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  $('auth-password').minLength = mode === 'signup' ? 8 : 1;
  $('auth-mode-login').setAttribute('aria-pressed', String(mode === 'login'));
  $('auth-mode-signup').setAttribute('aria-pressed', String(mode === 'signup'));
}
export function openAuth() {
  if (!auth) return;
  feedback(''); render(); $('auth-dialog').showModal();
  if (!currentUser()) $('auth-email').focus();
}
export function setBudget(budget) {
  if (!canChat()) return;
  $('chat-budget').textContent = `今日预算占用 ¥${budget.usedCny.toFixed(3)} / ¥2.00`;
  $('chat-budget').title = '含生成中预留费用；按高峰价保守核算，北京时间零点重置。';
}
export function authUnavailable() {
  $('chat-login').disabled = true;
  $('chat-budget').textContent = '邮箱登录服务暂不可用，请刷新重试。';
}
export function initAuth(config, onChange, requiresEmailVerification = true) {
  requireVerification = requiresEmailVerification !== false;
  changed = onChange;
  auth = getAuth(initializeApp(config)); auth.languageCode = 'zh-CN';
  onIdTokenChanged(auth, user => { render(); changed(user); });
  $('chat-login').disabled = false;
}
$('chat-login').addEventListener('click', openAuth);
$('auth-close').addEventListener('click', () => $('auth-dialog').close());
for (const value of ['login', 'signup']) $('auth-mode-' + value).addEventListener('click', () => {
  if (working) return;
  mode = value; feedback(''); render();
});
$('auth-form').addEventListener('submit', async event => {
  event.preventDefault(); if (working || !auth) return;
  if (mode === 'signup' && $('auth-password').value !== $('auth-confirm').value) { feedback('两次输入的密码不一致。'); return; }
  busy(true); feedback('正在处理…');
  try {
    const email = $('auth-email').value.trim(), password = $('auth-password').value;
    if (mode === 'signup') {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      if (requireVerification) {
        await sendEmailVerification(result.user); resendAfter = Date.now() + 60000;
        feedback('验证邮件已发送，请检查收件箱和垃圾邮件。完成后点击“我已验证”。');
      } else $('auth-dialog').close();
    } else {
      await signInWithEmailAndPassword(auth, email, password);
      if (canChat()) $('auth-dialog').close();
      else feedback('请先完成邮箱验证；需要时可重新发送验证邮件。');
    }
    $('auth-password').value = ''; $('auth-confirm').value = '';
  } catch (error) { showError(error); }
  finally { busy(false); render(); }
});
$('auth-resend').addEventListener('click', async () => {
  if (working || !currentUser()) return;
  if (Date.now() < resendAfter) { feedback('邮件已发送，请等待一分钟再试。'); return; }
  busy(true);
  try { await sendEmailVerification(currentUser()); resendAfter = Date.now() + 60000; feedback('验证邮件已发送。'); }
  catch (error) { showError(error); } finally { busy(false); }
});
$('auth-refresh').addEventListener('click', async () => {
  if (working || !currentUser()) return;
  busy(true);
  try {
    await reload(currentUser()); await getIdToken(currentUser(), true); render(); changed(currentUser());
    if (canChat()) $('auth-dialog').close(); else feedback('尚未检测到验证完成，请先点击邮件中的链接。');
  } catch (error) { showError(error); } finally { busy(false); }
});
$('auth-reset-password').addEventListener('click', async () => {
  if (working || !$('auth-email').reportValidity() || !$('auth-email').value.trim()) return;
  busy(true);
  try { await sendPasswordResetEmail(auth, $('auth-email').value.trim()); feedback('如果该邮箱可以重置密码，你将收到邮件，请检查收件箱。'); }
  catch (error) { showError(error); } finally { busy(false); }
});
$('auth-dialog-logout').addEventListener('click', async () => {
  if (working) return; busy(true);
  try { await signOut(auth); $('auth-dialog').close(); } catch (error) { showError(error); }
  finally { busy(false); }
});
