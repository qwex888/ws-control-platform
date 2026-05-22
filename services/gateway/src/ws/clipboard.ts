export type ClipboardPolicyInput = {
  globalDefaultEnabled: boolean
  sessionOverride?: boolean
}

export const resolveClipboardPolicy = ({
  globalDefaultEnabled,
  sessionOverride,
}: ClipboardPolicyInput): boolean => sessionOverride ?? globalDefaultEnabled
