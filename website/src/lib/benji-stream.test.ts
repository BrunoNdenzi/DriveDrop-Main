import { describe, expect, it } from 'vitest'
import { readReplyStream, takeEvents } from './benji-stream'

const encode = (text: string) => new TextEncoder().encode(text)

function responseOf(chunks: string[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encode(chunk))
      controller.close()
    },
  })
  return { body: stream } as unknown as Response
}

describe('takeEvents', () => {
  it('returns whole events and keeps the unfinished one', () => {
    const { events, rest } = takeEvents('event: sentence\ndata: {"text":"Hi there."}\n\nevent: sentence\ndata: {"te')
    expect(events).toEqual([{ event: 'sentence', data: '{"text":"Hi there."}' }])
    expect(rest).toBe('event: sentence\ndata: {"te')
  })

  it('copes with Windows line endings', () => {
    expect(takeEvents('event: done\r\ndata: {}\r\n\r\n').events).toEqual([{ event: 'done', data: '{}' }])
  })
})

describe('readReplyStream', () => {
  it('hands over each sentence as it arrives, even when events are split across chunks', async () => {
    const heard: string[] = []
    const result = await readReplyStream(responseOf([
      'event: sentence\ndata: {"text":"Sure thing."}\n\nevent: sen',
      'tence\ndata: {"text":"Two miles to go."}\n\n',
      'event: done\ndata: {"reply":"Sure thing. Two miles to go.","usage":{"costUsd":0.0003}}\n\n',
    ]), sentence => heard.push(sentence))
    expect(heard).toEqual(['Sure thing.', 'Two miles to go.'])
    expect(result).toEqual({ reply: 'Sure thing. Two miles to go.', costUsd: 0.0003, streamed: true })
  })

  it('returns an action without any sentences', async () => {
    const result = await readReplyStream(responseOf([
      'event: done\ndata: {"reply":"Want me to re-plan?","action":{"type":"replan","confirm":true}}\n\n',
    ]), () => { throw new Error('nothing to say yet') })
    expect(result).toEqual({ reply: 'Want me to re-plan?', action: { type: 'replan', confirm: true }, streamed: false })
  })

  it('fails when the server reports an error or the stream ends early', async () => {
    await expect(readReplyStream(responseOf(['event: error\ndata: {"message":"Benji is unavailable"}\n\n']), () => undefined)).rejects.toThrow('Benji is unavailable')
    await expect(readReplyStream(responseOf(['event: sentence\ndata: {"text":"Half a reply."}\n\n']), () => undefined)).rejects.toThrow('cut off')
  })
})
