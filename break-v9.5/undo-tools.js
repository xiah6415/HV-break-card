/* Fixed-seed decision replay. Does not serialize async engine continuations. */
(function(root) {
'use strict';
const copy = value => JSON.parse(JSON.stringify(value));
class Cancelled extends Error {}
let sessionId = 0;

class UndoSession {
  constructor(engine, options) {
    this.engine = engine;
    this.options = options;
    this.seed = options.seed ?? (Date.now() >>> 0);
    this.localPlayer = options.localPlayer ?? 0;
    this.gameId = options.gameId || 'local-' + this.seed + '-' + (++sessionId);
    this.revision = 0;
    this.requestNo = 0;
    this.takeback = null;
    this.entries = [];
    this.replaying = false;
    this.token = null;
    this.game = null;
  }
  stop() {
    const token = this.token;
    if (!token || token.cancelled) return;
    token.cancelled = true;
    this.takeback = null;
    token.abort(new Cancelled('Old game cancelled'));
    this.resume();
  }
  pause() { if (this.token) this.token.paused = true; }
  resume() {
    if (!this.token) return;
    this.token.paused = false;
    this.token.waiters.splice(0).forEach(resolve => resolve());
  }
  async ready(token) {
    while (token.paused && !token.cancelled) await new Promise(resolve => token.waiters.push(resolve));
    if (token.cancelled || token !== this.token) throw new Cancelled('Old game cancelled');
  }
  status(player = this.localPlayer) {
    const g = this.game;
    if (![0, 1].includes(player) || !g || g.winner || this.replaying || this.token?.cancelled) return { enabled: false, opponent: false, target: -1 };
    const owner = g.turnP?.idx ?? null;
    const opponent = owner === 1 - player || (owner === null && g.current === 1 - player);
    let target = -1;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i];
      if (entry.actor === player && entry.kind !== 'roll' && (opponent ?
        entry.owner === player || (owner === null && entry.owner === null) :
        entry.owner === owner && entry.turn === g.turnNo)) { target = i; break; }
    }
    return { enabled: target >= 0, opponent, target };
  }
  undo() {
    const status = this.status();
    if (!status.enabled || status.opponent || this.takeback) return false;
    this.start(this.entries.slice(0, status.target));
    return true;
  }
  requestTakeback(player = this.localPlayer) {
    const status = this.status(player);
    if (!status.enabled || !status.opponent || this.takeback) return null;
    const request = {
      id: this.gameId + ':' + (++this.requestNo), gameId: this.gameId,
      requester: player, responder: 1 - player, revision: this.revision,
      target: status.target, turn: this.game.turnNo
    };
    this.takeback = request;
    this.pause();
    return copy(request);
  }
  resolveTakeback(id, responder, accepted) {
    const request = this.takeback;
    if (typeof accepted !== 'boolean' || !request || request.id !== id || request.responder !== responder || request.revision !== this.revision || request.turn !== this.game.turnNo) return false;
    const status = this.status(request.requester);
    if (!status.enabled || status.target !== request.target || !status.opponent) return false;
    this.takeback = null;
    if (accepted) this.start(this.entries.slice(0, request.target));
    else this.resume();
    return true;
  }
  cancelTakeback(id, requester = this.localPlayer) {
    if (!this.takeback || this.takeback.id !== id || this.takeback.requester !== requester) return false;
    this.takeback = null;
    this.resume();
    return true;
  }
  start(prefix = []) {
    this.stop();
    const token = { cancelled: false, paused: false, waiters: [], cursor: 0, prefix: copy(prefix) };
    token.aborted = new Promise((resolve, reject) => { token.abort = reject; });
    token.aborted.catch(() => {});
    this.token = token;
    this.revision++;
    this.entries = [];
    this.replaying = prefix.length > 0;
    const active = () => token === this.token && !token.cancelled;
    const providers = this.options.agents || [this.options.human, this.options.ai];
    const agents = providers.map((provider, actor) => ({
      label: provider.label || (actor === 0 ? '你' : 'AI'),
      wantsAck: provider.wantsAck ?? actor === this.localPlayer,
      choose: async (g, p, req) => {
        await this.ready(token);
        g.current = actor;
        const checkpoint = {
          actor, owner: g.turnP?.idx ?? null, turn: g.turnNo, kind: req.kind,
          signature: JSON.stringify(req)
        };
        let value;
        if (token.cursor < token.prefix.length) {
          const previous = token.prefix[token.cursor++];
          if (previous.actor !== actor || previous.turn !== checkpoint.turn || previous.signature !== checkpoint.signature) {
            throw new Error('悔棋紀錄與對局不一致，請重新開始對局');
          }
          value = copy(previous.value);
        } else {
          this.replaying = false;
          this.options.onUpdate?.(g);
          value = await Promise.race([provider.choose(g, p, req), token.aborted]);
          await this.ready(token);
        }
        this.entries.push({ ...checkpoint, value: copy(value) });
        this.revision++;
        return value;
      }
    }));
    const g = new this.engine.Game({
      seed: this.seed, decks: this.options.decks, reveal: this.localPlayer, agents,
      onLog: (s, cls) => { if (active()) this.options.onLog?.(s, cls); },
      onNotice: async notice => {
        await this.ready(token);
        // Presentation pauses are not decisions; skip them while restoring history.
        if (this.replaying || !this.options.onNotice) return;
        await Promise.race([this.options.onNotice(g, notice), token.aborted]);
        await this.ready(token);
      },
      onUpdate: () => { if (active() && !this.replaying) this.options.onUpdate?.(g); }
    });
    this.game = g;
    this.options.onGame?.(g);
    this.done = g.run().then(winner => {
      if (active()) this.options.onUpdate?.(g);
      return winner;
    }).catch(error => {
      if (active() && !(error instanceof Cancelled)) {
        this.replaying = false;
        this.stop();
        this.options.onError?.(error);
      }
      return null;
    });
    return g;
  }
}
const api = { UndoSession };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
else root.BreakUndoTools = api;
})(typeof window !== 'undefined' ? window : globalThis);
