import {createFrictionChatPayload} from '../friction/chat-context.mjs';
import {estimate, fields} from './mechanics.mjs';

const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 160) : '';
const copyParameters = source => Object.fromEntries(Object.keys(fields).map(key => [key, finite(source?.[key])]));
const formatParameters = parameters => Object.entries(fields).map(([key, [label, unit]]) => `${label}=${parameters[key] ?? '无效'} ${unit}`).join('；');

export function captureRackContext(state) {
  if (!state || typeof state !== 'object') return null;
  const parameters = copyParameters(state.params);
  const modelParameters = state.modelParameters ? copyParameters(state.modelParameters) : null;
  const direction = state.view?.direction === -1 ? -1 : 1;
  const angle = finite(state.view?.angle);
  let result = null;
  if (state.geometryValid !== false && angle !== null) {
    try { result = estimate(parameters, angle); result.velocity = result.velocity ? result.velocity * direction : 0; } catch { /* Invalid snapshots retain their inputs. */ }
  }
  return {parameters, modelParameters, direction, angle, zeroPosition: finite(state.zeroPosition), result,
    disassembled: (state.view?.amount || 0) > 0 || (state.view?.step || 0) > 0,
    selectedPart: {name: text(state.selectedPart?.name), description: text(state.selectedPart?.description)}};
}

export function formatRackContext(context) {
  const {parameters, result, selectedPart} = context;
  return [
    '本次提问讨论齿轮齿条传动。以下是提问时的页面数据，请按此解释。',
    formatParameters(parameters),
    !result && context.modelParameters ? '当前显示的上一有效模型：'+formatParameters(context.modelParameters) : '',
    `选择方向：${context.direction===-1?'向左，负向':'向右，正向'}。${context.disassembled?'正在拆装，传动暂停。':''}`,
    `转角=${context.angle ?? '无效'}°；测量基准=${context.zeroPosition ?? '无效'} mm。`,
    result ? `齿条位置=${result.displacement.toFixed(4)} mm；每圈位移=${result.perTurn.toFixed(4)} mm；齿距=${result.pitch.toFixed(4)} mm；理论线速度=${result.velocity.toFixed(4)} mm/s。` : '当前输入无效，画面保留上次有效结构，当前计算已暂停。',
    `选中零件：${selectedPart.name}。${selectedPart.description}`,
    '压力角20°；d=mz；s=πmzθ/360；v=πmzn/60。正视逆时针为正，齿条向右。演示速度为工况的20%乘播放倍速。刚体运动教学，忽略摩擦、弹性与间隙回程；齿根过渡简化。请解释而不要声称已操作页面。',
  ].join('\n');
}

// The deployed service already accepts a bounded textual model snapshot.
// Preserve the existing payload builders for every other experiment.
export function createRackChatPayload(turns, capabilities) {
  if (!turns.some(turn => turn.rackContext)) return createFrictionChatPayload(turns, capabilities);
  const messages = turns.map(({role, content, rackContext}) => ({role,
    content: role === 'user' && rackContext ? formatRackContext(rackContext) + '\n问题：' + content : content}));
  if (messages.some(message => message.role === 'user' && message.content.length > 2000)) {
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  }
  while (messages.length > 1 && messages.reduce((sum, message) => sum + message.content.length, 0) > 32000) {
    messages.splice(0, 2);
  }
  return {messages};
}
