export interface SseEvent {
  event: string
  data: string
}

// Splits what has arrived of a server-sent event stream into whole events; an unfinished one stays in `rest`.
export function takeEvents(buffer: string): { events: SseEvent[]; rest: string } {
  const events: SseEvent[] = []
  let rest = buffer.replace(/\r\n/g, '\n')
  let boundary = rest.indexOf('\n\n')
  while (boundary !== -1) {
    const block = rest.slice(0, boundary)
    rest = rest.slice(boundary + 2)
    let event = 'message'
    const data: string[] = []
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) event = line.slice(6).trim()
      else if (line.startsWith('data:')) data.push(line.slice(5).trim())
    }
    if (data.length > 0) events.push({ event, data: data.join('\n') })
    boundary = rest.indexOf('\n\n')
  }
  return { events, rest }
}

export interface StreamedReply {
  reply: string
  action?: { type: string; confirm: boolean }
  costUsd?: number
  // At least one sentence was handed over while the reply was still being written.
  streamed: boolean
}

// Reads a spoken reply from the server as it is written, handing over each sentence the moment it is complete.
export async function readReplyStream(response: Response, onSentence: (sentence: string) => void): Promise<StreamedReply> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Streaming is not available')
  const decoder = new TextDecoder()
  let buffer = ''
  let handed = 0
  let finished: StreamedReply | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (value) buffer += decoder.decode(value, { stream: !done })
    const taken = takeEvents(buffer)
    buffer = taken.rest
    for (const item of taken.events) {
      const payload = JSON.parse(item.data) as { text?: string; message?: string; reply?: string; action?: { type: string; confirm: boolean }; usage?: { costUsd?: number } }
      if (item.event === 'sentence' && payload.text) {
        handed += 1
        onSentence(payload.text)
      } else if (item.event === 'error') {
        throw new Error(payload.message || 'Benji is unavailable')
      } else if (item.event === 'done') {
        finished = {
          reply: payload.reply ?? '',
          ...(payload.action ? { action: payload.action } : {}),
          ...(payload.usage?.costUsd !== undefined ? { costUsd: payload.usage.costUsd } : {}),
          streamed: handed > 0,
        }
      }
    }
    if (done) break
  }
  if (!finished) throw new Error('The reply was cut off')
  return finished
}
