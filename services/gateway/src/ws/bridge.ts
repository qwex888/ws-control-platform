import { ResumeStore } from './resume'

export type ResumeRequest = {
  token: string
  now: number
}

export type ResumeResult =
  | { resumed: true; sessionId: string; userId: string }
  | { resumed: false; reason: 'NOT_FOUND_OR_EXPIRED' }

export const createBridge = (ttlMs = 120000) => {
  const resumeStore = new ResumeStore(ttlMs)

  return {
    issueResumeToken: (token: string, sessionId: string, userId: string, now: number) =>
      resumeStore.upsert(token, sessionId, userId, now),
    tryResume: ({ token, now }: ResumeRequest): ResumeResult => {
      const found = resumeStore.resume(token, now)
      if (!found) return { resumed: false, reason: 'NOT_FOUND_OR_EXPIRED' }
      return { resumed: true, sessionId: found.sessionId, userId: found.userId }
    },
    keepAlive: (token: string, now: number) => resumeStore.heartbeat(token, now),
  }
}
