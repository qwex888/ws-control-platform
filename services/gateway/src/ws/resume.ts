export type ResumeRecord = {
  sessionId: string
  userId: string
  expiresAt: number
  lastSeenAt: number
}

export class ResumeStore {
  private readonly ttlMs: number
  private readonly records = new Map<string, ResumeRecord>()

  constructor(ttlMs: number) {
    this.ttlMs = ttlMs
  }

  upsert(token: string, sessionId: string, userId: string, now: number): ResumeRecord {
    const record: ResumeRecord = {
      sessionId,
      userId,
      expiresAt: now + this.ttlMs,
      lastSeenAt: now,
    }
    this.records.set(token, record)
    return record
  }

  resume(token: string, now: number): ResumeRecord | null {
    const record = this.records.get(token)
    if (!record) return null
    if (record.expiresAt <= now) {
      this.records.delete(token)
      return null
    }
    return record
  }

  heartbeat(token: string, now: number): ResumeRecord | null {
    const record = this.resume(token, now)
    if (!record) return null
    const next: ResumeRecord = {
      ...record,
      lastSeenAt: now,
      expiresAt: now + this.ttlMs,
    }
    this.records.set(token, next)
    return next
  }
}
