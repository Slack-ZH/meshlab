// Consume only visible answer text from a DeepSeek SSE stream.
export async function readCompletion(body, onDelta) {
  if (!body) throw new Error('回复内容为空，请重试。');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', answer = '', finished = false, finishReason = null;
  function event(block) {
    const data = block.split('\n').filter(line => line.startsWith('data:'))
      .map(line => line.slice(5).trimStart()).join('\n').trim();
    if (!data) return;
    if (data === '[DONE]') { finished = true; return; }
    const chunk = JSON.parse(data);
    if (chunk.error) throw new Error('AI 回复中断，请重试。');
    const choice = chunk.choices?.[0];
    if (choice?.finish_reason) finishReason = choice.finish_reason;
    const delta = choice?.delta?.content;
    if (typeof delta === 'string' && delta) {
      answer += delta;
      if (answer.length > 24000) throw new Error('回复过长，请缩小问题范围。');
      onDelta(delta);
    }
  }
  try {
    while (!finished) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      // Normalize after buffering so CRLF split across chunks stays intact.
      buffer = buffer.replace(/\r\n/g, '\n');
      let boundary;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) {
        event(buffer.slice(0, boundary));
        buffer = buffer.slice(boundary + 2);
        if (finished) break;
      }
      if (done) { if (buffer.trim()) event(buffer); break; }
      if (buffer.length > 65536) throw new Error('回复格式异常，请重试。');
    }
    if (!finished) throw new Error('连接中断，回复未完成，请重试。');
    if (!answer.trim()) throw new Error('AI 暂未返回文字，请换个问题重试。');
    if (finishReason && !['stop', 'length'].includes(finishReason)) {
      throw new Error('AI 未能完成回复，请重试或调整问题。');
    }
    return { answer, truncated: finishReason === 'length' };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
