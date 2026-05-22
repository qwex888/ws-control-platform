export type SessionUser = {
  username: string
}

export type SessionStore = {
  users: Map<string, SessionUser>
}

export const createSessionStore = (): SessionStore => ({
  users: new Map<string, SessionUser>(),
})
