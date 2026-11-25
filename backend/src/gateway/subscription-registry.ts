/**
 * One connected user. It holds that user's own watch list and the quotes still
 * waiting to be sent, so nothing one user does can touch another user's state.
 */
export class ClientSession<S = unknown> {
  readonly symbols = new Set<string>();
  /** Latest serialised quote per symbol, waiting for the next flush. */
  readonly pending = new Map<string, string>();
  isAlive = true;

  constructor(readonly socket: S) {}
}

/**
 * Reverse index from a symbol to everyone watching it. A tick walks only the
 * watchers of the symbols that moved, never the whole connection list.
 */
export class SubscriptionRegistry<S = unknown> {
  private readonly sessions = new Map<S, ClientSession<S>>();
  private readonly watchers = new Map<string, Set<ClientSession<S>>>();
  private subscriptions = 0;

  get size(): number {
    return this.sessions.size;
  }

  /** Stock subscriptions summed over every session. */
  get subscriptionCount(): number {
    return this.subscriptions;
  }

  open(socket: S): ClientSession<S> {
    const session = new ClientSession(socket);
    this.sessions.set(socket, session);
    return session;
  }

  get(socket: S): ClientSession<S> | undefined {
    return this.sessions.get(socket);
  }

  all(): IterableIterator<ClientSession<S>> {
    return this.sessions.values();
  }

  /** Symbols this session was not already watching are returned. */
  subscribe(session: ClientSession<S>, symbols: readonly string[]): string[] {
    const added: string[] = [];
    for (const symbol of symbols) {
      if (session.symbols.has(symbol)) continue;
      session.symbols.add(symbol);
      let set = this.watchers.get(symbol);
      if (!set) this.watchers.set(symbol, (set = new Set()));
      set.add(session);
      added.push(symbol);
      this.subscriptions += 1;
    }
    return added;
  }

  unsubscribe(session: ClientSession<S>, symbols: readonly string[]): void {
    for (const symbol of symbols) {
      if (!session.symbols.delete(symbol)) continue;
      this.subscriptions -= 1;
      session.pending.delete(symbol);
      const set = this.watchers.get(symbol);
      if (!set) continue;
      set.delete(session);
      if (set.size === 0) this.watchers.delete(symbol);
    }
  }

  watchersOf(symbol: string): ReadonlySet<ClientSession<S>> | undefined {
    return this.watchers.get(symbol);
  }

  close(socket: S): void {
    const session = this.sessions.get(socket);
    if (!session) return;
    this.unsubscribe(session, [...session.symbols]);
    this.sessions.delete(socket);
  }
}
