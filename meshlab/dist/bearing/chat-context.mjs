import { createCatalogChatPayload } from '../catalog/chat-context.mjs';
import { BEARING_TYPES } from './mechanics.mjs';

const numericParamLabels = {
  boreDiameter: '内径 d mm',
  outerDiameter: '外径 D mm',
  width: '宽度/高度 B mm',
  elementCount: '滚动体数 Z',
  contactAngle: '接触角 α °',
  innerRPM: '内圈/轴圈转速 r/min',
  radialLoad: '径向载荷 Fr kN',
  axialLoad: '轴向载荷 Fa kN',
  dynamicRatingC: '参考额定动载荷 C kN',
};

const resultLabels = {
  innerRPM: '内圈转速 r/min',
  cageRPM: '保持架转速 r/min',
  cageRatio: '保持架速比 nc/ni',
  elementSpinRPM: '滚动体相对自转 r/min',
  ftfHz: '保持架频率 FTF Hz',
  bpfoHz: '外圈通过频率 BPFO Hz',
  bpfiHz: '内圈通过频率 BPFI Hz',
  bsfHz: '滚动体自转频率 BSF Hz',
  equivalentLoad: '当量动载荷 P kN',
  l10MillionRev: '参考寿命 L10 百万转',
  l10Hours: '参考小时寿命 L10h h',
};

const geometryLabels = {
  pitchDiameter: '节圆直径 Dm mm',
  elementDiameter: '滚动体均径 Dw mm',
  rollerLength: '滚子长度 Lw mm',
  contactAngleDeg: '有效接触角 °',
};

const cleanText = (value, max) => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '');
const finite = value => (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e12 ? value : null);
const copyNumbers = (source, labels) => Object.fromEntries(Object.keys(labels).map(key => [key, finite(source?.[key])]));
const formatNumbers = (source, labels) =>
  Object.entries(labels)
    .map(([key, label]) => `${label}=${source[key] === null ? '无效/未求解' : Number(source[key].toPrecision(6))}`)
    .join('；');

function cleanBearingType(raw) {
  return typeof raw === 'string' && Object.hasOwn(BEARING_TYPES, raw) ? raw : null;
}

export function captureBearingContext(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return null;
  const part = state.selectedPart || {};
  const result = state.result;
  const geometry = state.geometry || result?.geometry;
  const srcParams = state.params || state.parameters || {};
  const srcModel = state.modelParameters;

  const parameters = {
    bearingType: cleanBearingType(srcParams.bearingType),
    ...copyNumbers(srcParams, numericParamLabels),
  };
  const modelParameters = srcModel
    ? {
        bearingType: cleanBearingType(srcModel.bearingType),
        ...copyNumbers(srcModel, numericParamLabels),
      }
    : null;

  return {
    parameters,
    modelParameters,
    selectedPart: {
      id: cleanText(part.id || state.selected || state.view?.selected, 80),
      name: cleanText(part.name, 80),
      description: cleanText(part.description, 180),
      spec: cleanText(part.spec, 120),
    },
    result: result && typeof result === 'object' && !Array.isArray(result) ? copyNumbers(result, resultLabels) : null,
    geometry: geometry && typeof geometry === 'object' && !Array.isArray(geometry) ? copyNumbers(geometry, geometryLabels) : null,
    loadValid: typeof result?.loadValid === 'boolean' ? result.loadValid : state.loadValid !== false,
    geometryValid: state.geometryValid !== false,
    housingMode: ['open', 'solid', 'transparent', 'hidden'].includes(state.view?.housingMode || state.housingMode)
      ? state.view?.housingMode || state.housingMode
      : null,
  };
}

export function sanitizeBearingContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  return captureBearingContext({
    parameters: context.parameters,
    modelParameters: context.modelParameters,
    selectedPart: context.selectedPart,
    result: context.result,
    geometry: context.geometry,
    loadValid: context.loadValid,
    geometryValid: context.geometryValid,
    housingMode: context.housingMode,
  });
}

export function formatBearingContext(raw, { legacy = false } = {}) {
  const context = sanitizeBearingContext(raw);
  if (!context) return '';
  const { parameters, modelParameters, selectedPart: part, result, geometry, loadValid, geometryValid, housingMode } = context;
  const typeInfo = parameters.bearingType ? BEARING_TYPES[parameters.bearingType] : null;
  const typeLabel = typeInfo ? `${typeInfo.name}（${typeInfo.id}，${typeInfo.axialNote}）` : '轴承类型无效/未提供';
  const differs = modelParameters && JSON.stringify(parameters) !== JSON.stringify(modelParameters);
  const modeMap = { open: '剖切外圈', solid: '完整外圈', transparent: '透明外圈', hidden: '隐藏外圈' };

  const lines = [
    legacy
      ? '本次提问的独立模型是滚动轴承结构教学实验。请以本次快照回答，不套用 GL16 减速器或其他设备的参数与零件。'
      : '【本次提问时的滚动轴承页面快照；数值为用户输入】',
    `当前轴承类型：${typeLabel}${housingMode ? `；外圈显示：${modeMap[housingMode]}` : ''}`,
    formatNumbers(parameters, numericParamLabels),
    part.id || part.name ? `选中零件：${part.name || part.id}；${part.description}${part.spec ? '；' + part.spec : ''}` : '尚未选择零件。',
    differs ? '输入与当前显示模型不同，视图保留上一有效结构。' : '',
    geometryValid ? '' : '当前几何输入无效，模型保留上一有效结构。',
    loadValid ? '' : '当前载荷方向超出该类型轴承允许范围（如 N 型圆柱滚子不承受轴向载荷，推力球不承受径向载荷），寿命未求解。',
    result ? '页面计算：' + formatNumbers(result, resultLabels) : '当前输入没有有效计算结果。',
    geometry ? '几何尺寸：' + formatNumbers(geometry, geometryLabels) : '',
    '运动关系按外圈/座圈固定、内圈/轴圈转动、滚道理想纯滚动计算：径向/推力 nc=0.5*ni*(1-(Dw/Dm)*cosα)，圆锥滚子采用共顶纯滚动精确解；1×动画为工况转速3%慢放。',
    '寿命按 ISO 281 基本公式 L10=(C/P)^p（球 p=3、滚子 p=10/3）教学估算，C 由用户给定，不是厂商样本校核或制造图纸；深沟球实物不可分离，拆装为剖视教学展示。请仅做文字解释，不声称已操作或验收模型。',
  ];
  return lines.filter(Boolean).join('\n').slice(0, 1550);
}

// Preserve every existing model payload and support both native and legacy backends.
export function createBearingChatPayload(turns, { supportsBearing = false, ...capabilities } = {}) {
  if (!turns.some(turn => turn.bearingContext)) return createCatalogChatPayload(turns, capabilities);
  if (
    turns.some(
      turn =>
        turn.turbineContext ||
        turn.bicycleContext ||
        turn.frictionContext ||
        turn.spurContext ||
        turn.idlerContext ||
        turn.beltContext ||
        turn.timingContext ||
        turn.viceContext ||
        turn.catalogContext
    )
  ) {
    throw new Error('模型已切换，请开始新对话后重试。');
  }
  const messages = turns.map(({ role, content, bearingContext }) => {
    const snapshot = role === 'user' ? sanitizeBearingContext(bearingContext) : null;
    return {
      role,
      content: snapshot && !supportsBearing ? formatBearingContext(snapshot, { legacy: true }) + '\n问题：' + content : content,
      ...(snapshot && supportsBearing ? { bearingContext: snapshot } : {}),
    };
  });
  if (messages.some(message => message.role === 'user' && message.content.length > 2000)) {
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  }
  while (messages.length > 1 && messages.reduce((sum, message) => sum + message.content.length, 0) > 32000) {
    messages.splice(0, 2);
  }
  return { messages, ...(supportsBearing ? { modelContext: 'bearing' } : {}) };
}
