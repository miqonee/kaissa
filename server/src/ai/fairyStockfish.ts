import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { createRequire } from 'node:module';
import { createInterface, type Interface } from 'node:readline';

export interface FairyCandidate { uci: string; score: number }
const require = createRequire(import.meta.url);
// The npm engine exposes a virtual filesystem. Keep variant configuration in
// that filesystem, rather than relying on a host file visible to WASM.
const launcher = `
const readline = require('node:readline');
const fs = require('node:fs');
const path = require('node:path');
require(process.argv[1])({wasmBinary:fs.readFileSync(path.join(path.dirname(process.argv[1]), 'stockfish.wasm'))}).then(sf => {
  sf.FS.writeFile('/kaissa.ini', '[kaissa-bughouse:bughouse]\\nnMoveRule = 0\\nnFoldRule = 0\\nstalemateValue = loss\\n');
  sf.postMessage('load /kaissa.ini');
  const input = readline.createInterface({input:process.stdin});
  input.on('line', line => { sf.postMessage(line); if(line === 'quit') process.exit(0); });
}).catch(err => { console.error(err); process.exit(1); });`;

/** One isolated UCI process with a serial request queue and a hard deadline. */
export class FairyStockfish {
  private proc: ChildProcessWithoutNullStreams | null = null;
  private lines: Interface | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private idleTimer?: NodeJS.Timeout;
  constructor(private modulePath?: string) {}

  private exchange(command: string, accept: (line: string) => boolean, timeout: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = this.proc!;
      const lines = this.lines!;
      let settled = false;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        lines.off('line', onLine);
        proc.off('exit', onExit);
        proc.off('error', onError);
        if (error) reject(error); else resolve();
      };
      const onLine = (line: string) => { if (accept(line.trim())) finish(); };
      const onExit = () => finish(new Error('Fairy-Stockfish exited'));
      const onError = (err: Error) => finish(err);
      const timer = setTimeout(() => { finish(new Error('Fairy-Stockfish deadline exceeded')); this.quit(); }, timeout);
      lines.on('line', onLine);
      proc.once('exit', onExit);
      proc.once('error', onError);
      proc.stdin.write(command + '\n', error => { if (error) finish(error); });
    });
  }
  private async ready(): Promise<void> {
    if (this.proc) return;
    const modulePath = this.modulePath ?? require.resolve('fairy-stockfish-nnue.wasm/stockfish.js');
    this.proc = spawn(process.execPath, ['-e', launcher, modulePath], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
    this.proc.stderr.resume();
    this.proc.stdin.on('error', () => {});
    this.lines = createInterface({ input: this.proc.stdout });
    try {
      let variantAvailable = false;
      await this.exchange('uci', line => {
        if (line.includes('kaissa-bughouse')) variantAvailable = true;
        return line === 'uciok';
      }, 10_000);
      if (!variantAvailable) throw new Error('Fairy-Stockfish does not expose kaissa-bughouse');
      await this.exchange('setoption name Threads value 1\nsetoption name Hash value 16\nsetoption name Use NNUE value false\nsetoption name UCI_Variant value kaissa-bughouse\nisready', line => line === 'readyok', 2000);
    } catch (error) { this.quit(); throw error; }
  }
  search(fen: string, level: number, budgetMs: number): Promise<FairyCandidate[]> {
    const job = this.queue.then(async () => {
      clearTimeout(this.idleTimer);
      await this.ready();
      const candidates = new Map<number, FairyCandidate>();
      try {
        await this.exchange(`setoption name Skill Level value ${Math.round((Math.max(1, Math.min(12, level)) - 1) * 20 / 11)}\nsetoption name MultiPV value 4\nposition fen ${fen}\ngo movetime ${Math.max(20, Math.round(budgetMs))}`, line => {
          const pv = line.match(/\bpv\s+(\S+)/);
          const cp = line.match(/\bscore cp (-?\d+)/);
          const mate = line.match(/\bscore mate (-?\d+)/);
          if (pv && (cp || mate)) {
            const n = mate ? Number(mate[1]) : 0;
            candidates.set(Number(line.match(/multipv (\d+)/)?.[1] ?? 1), { uci: pv[1], score: mate ? Math.sign(n) * (90000 - Math.abs(n)) : Number(cp![1]) });
          }
          if (!line.startsWith('bestmove ')) return false;
          const best = line.split(/\s+/)[1];
          if (!candidates.size && best && best !== '(none)' && best !== '0000') candidates.set(1, { uci: best, score: 0 });
          return true;
        }, Math.max(1500, budgetMs + 1000));
        return [...candidates.entries()].sort(([a], [b]) => a - b).map(([, candidate]) => candidate);
      } catch (error) { this.quit(); throw error; }
      finally { this.idleTimer = setTimeout(() => this.quit(), 60_000); this.idleTimer.unref(); }
    });
    this.queue = job.catch(() => {});
    return job;
  }
  quit(): void {
    clearTimeout(this.idleTimer);
    this.lines?.close();
    this.proc?.kill();
    this.lines = null;
    this.proc = null;
  }
}

export class FairyPool {
  private engines = [new FairyStockfish(), new FairyStockfish()];
  private next = 0;
  search(fen: string, level: number, budgetMs: number): Promise<FairyCandidate[]> { return this.engines[this.next++ % 2].search(fen, level, budgetMs); }
  quit(): void { this.engines.forEach(engine => engine.quit()); }
}
export const fairyPool = new FairyPool();
