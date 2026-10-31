const entered = new Set<string>();

export const enteredSessions = {
  has: (sessionId: string | undefined): boolean =>
    sessionId !== undefined && entered.has(sessionId),
  mark: (sessionId: string | undefined): void => {
    if (sessionId !== undefined) entered.add(sessionId);
  },
  reset: (): void => entered.clear(),
};
