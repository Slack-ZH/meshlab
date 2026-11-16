// A small, explicit snapshot: no scene meshes, user identity or browser state.
const keys = ['height','chord','blades','hub','stages','p1','temperature','flow','p2','etaT','etaM'];
const labels = { height:'末级叶高 mm', chord:'根部轴向弦长 mm', blades:'每排叶片数', hub:'轮毂直径 mm', stages:'级数',
  p1:'进汽绝压 MPa', temperature:'进汽温度 °C', flow:'流量 kg/s', p2:'排汽绝压 MPa', etaT:'等熵效率', etaM:'机械效率' };
const types = { impulse:'冲动式', reaction:'反动式', condensing:'凝汽式', backpressure:'背压式' };
const cleanText = (value, max) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max) : '';
const finite = value => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e8 ? value : null;
const dimension = value => value === null ? '未知' : Number(value.toPrecision(6));
function bladeDesign(source) {
  if (!source || !Array.isArray(source.stages)) return null;
  return { stages: source.stages.slice(0, 6).map((row, index) => ({stage:index+1,
    height:finite(row?.height), chord:finite(row?.chord), tipDiameter:finite(row?.tipDiameter),
    minimumGap:finite(row?.minimumGap), spanTwistDeg:finite(row?.spanTwistDeg),
    statorProfile:cleanText(row?.statorProfile,24), rotorProfile:cleanText(row?.rotorProfile,24)})) };
}
function parameters(source = {}) {
  const result = {};
  for (const key of keys) {
    const value = source?.[key];
    result[key] = typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1e8 ? value : null;
  }
  result.work = ['impulse','reaction'].includes(source?.work) ? source.work : null;
  result.exhaust = ['condensing','backpressure'].includes(source?.exhaust) ? source.exhaust : null;
  return result;
}

export function captureTurbineContext(state) {
  if (!state || typeof state !== 'object') return null;
  const input = state.params || state.parameters || {};
  const part = state.selectedPart || {};
  const result = state.performance || state.result;
  return {
    parameters: parameters(input),
    modelParameters: state.modelParameters ? parameters(state.modelParameters) : null,
    selectedPart: { id: cleanText(part.id || state.selected || state.view?.selected, 80),
      name: cleanText(part.name, 80), description: cleanText(part.description, 180) },
    powerKw: typeof result?.power === 'number' && Number.isFinite(result.power) && result.power > 0 ? result.power : null,
    geometryValid: state.geometryValid !== false,
    bladeDesign: bladeDesign(state.bladeDesign || state.view?.bladeDesign),
  };
}

// Run both in the browser and on the server. Inputs here are user-provided data.
export function sanitizeTurbineContext(context) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) return null;
  return captureTurbineContext({ parameters: context.parameters, modelParameters: context.modelParameters,
    selectedPart: context.selectedPart, result: { power: context.powerKw }, geometryValid: context.geometryValid,
    bladeDesign: context.bladeDesign });
}

function formatParameters(p) {
  return [types[p.work], types[p.exhaust], ...keys.map(k => `${labels[k]}=${p[k] === null ? '无效/未提供' : Number(p[k].toPrecision(7))}`)].filter(Boolean).join('；');
}

export function formatTurbineContext(raw, { legacy = false } = {}) {
  const context = sanitizeTurbineContext(raw);
  if (!context) return '';
  const p = context.parameters, part = context.selectedPart;
  const modelDiffers = context.modelParameters && JSON.stringify(context.modelParameters) !== JSON.stringify(p);
  return [legacy ? '这次提问讨论另一个独立模型：轴流式汽轮机。请以本次快照回答，不套用 GL16 减速器资料。' : '【本次提问时的汽轮机页面快照；数值为用户输入】',
    formatParameters(p),
    part.id || part.name ? `选中零件：${part.name || part.id}${part.description ? '；' + part.description : ''}` : '尚未选择零件。',
    modelDiffers ? '输入与当前显示模型不同，模型仍为上一有效结构：' + formatParameters(context.modelParameters) : '',
    !context.geometryValid ? '当前几何输入无效，模型保留上一有效结构。' : '',
    context.bladeDesign?.stages.length ? '显示模型各级（尺寸 mm，间隙为叶片包络下界）：\n' + context.bladeDesign.stages.map(row =>
      `${row.stage}级：叶高${dimension(row.height)}，弦长${dimension(row.chord)}，叶尖径${dimension(row.tipDiameter)}，间隙≥${dimension(row.minimumGap)}；静叶${row.statorProfile || '未提供'}，动叶${row.rotorProfile || '未提供'}，扭转${dimension(row.spanTwistDeg)}°`
    ).join('\n') : '',
    context.powerKw === null ? '当前工况没有有效功率结果。' : `页面估算轴功率=${Number(context.powerKw.toPrecision(8))} kW。`,
    '模型是教学示意，未验证制造标准、逐级速度三角形或强度。几何间隙是包络校验，非完整碰撞/CFD验收。功率按指定流量、焓降和效率估算，叶片形状、数量和级数不直接改变功率。请只提供解释与操作建议，不声称已操作模型。',
  ].filter(Boolean).join('\n');
}

export function createChatPayload(turns, { supportsTurbine = false } = {}) {
  const turbine = turns.some(turn => turn.turbineContext);
  const messages = turns.map(({role,content,selectedPartId,turbineContext}) => {
    const snapshot = role === 'user' ? sanitizeTurbineContext(turbineContext) : null;
    if (turbine) {
      return { role, content: snapshot && !supportsTurbine ? formatTurbineContext(snapshot, {legacy:true}) + '\n问题：' + content : content,
        ...(snapshot && supportsTurbine ? {turbineContext:snapshot} : {}) };
    }
    return {role,content,selectedPartId};
  });
  // The existing service accepts 2000 characters per question and 32000 per thread.
  if (messages.some(m => m.role === 'user' && m.content.length > 2000)) {
    throw new Error('问题加上模型参数后超过长度限制，请缩短问题后重试。');
  }
  while (messages.length > 1 && messages.reduce((sum, m) => sum + m.content.length, 0) > 32000) messages.splice(0, 2);
  return { messages, ...(turbine && supportsTurbine ? {modelContext:'turbine'} : {}) };
}
