import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createRequire } from 'module';
import path from 'path';
import readline from 'readline';

const require = createRequire(import.meta.url);

export interface SearchCandidate {
  uci: string;
  score: number; // centipawns or +-90000 for mate
  depth: number;
  pv: string;
  multipv: number;
}

export interface SearchOptions {
  skillLevel?: number; // 0..20
  elo?: number; // target Elo (>= 1320 enables UCI_LimitStrength)
  multiPv?: number; // 1..4 (default 3)
  depth?: number; // default 8
  movetime?: number; // in ms (optional)
}

export interface SearchResult {
  bestmove: string;
  candidates: SearchCandidate[];
}

interface QueuedRequest {
  fen: string;
  opts: SearchOptions;
  resolve: (res: SearchResult) => void;
  reject: (err: Error) => void;
  timeoutTimer?: NodeJS.Timeout;
}

export class StockfishEngine {
  private binPath: string;
  private proc: ChildProcessWithoutNullStreams | null = null;
  private rl: readline.Interface | null = null;
  private queue: QueuedRequest[] = [];
  private busy = false;
  private currentReq: QueuedRequest | null = null;
  private currentCandidates: Map<number, SearchCandidate> = new Map();
  private readyPromise: Promise<void> | null = null;
  private isTerminated = false;

  constructor(customBinPath?: string) {
    if (customBinPath) {
      this.binPath = customBinPath;
    } else {
      try {
        const sfDir = path.dirname(require.resolve('stockfish'));
        this.binPath = path.join(sfDir, 'bin', 'stockfish-18-lite-single.js');
      } catch {
        this.binPath = path.resolve(process.cwd(), 'node_modules/stockfish/bin/stockfish-18-lite-single.js');
      }
    }
    this.readyPromise = this.spawnAndInit();
  }

  private spawnAndInit(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.proc = spawn(process.execPath, [this.binPath], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.rl = readline.createInterface({ input: this.proc.stdout });

        const initTimeout = setTimeout(() => {
          reject(new Error('Stockfish initialization timeout'));
        }, 10000);

        const onInitLine = (line: string) => {
          const trimmed = line.trim();
          if (trimmed === 'uciok') {
            this.proc?.stdin.write('isready\n');
          } else if (trimmed === 'readyok') {
            clearTimeout(initTimeout);
            this.rl?.removeListener('line', onInitLine);
            this.rl?.on('line', (l) => this.handleLine(l));
            resolve();
          }
        };

        this.rl.on('line', onInitLine);

        this.proc.on('error', (err) => {
          console.error('[Stockfish] Process error:', err);
          if (this.currentReq) {
            this.currentReq.reject(err);
            this.currentReq = null;
            this.busy = false;
          }
        });

        this.proc.on('exit', (code, signal) => {
          if (!this.isTerminated) {
            console.warn(`[Stockfish] Process exited unexpectedly (code ${code}, signal ${signal}), restarting...`);
            this.busy = false;
            if (this.currentReq) {
              this.currentReq.reject(new Error('Stockfish process exited during calculation'));
              this.currentReq = null;
            }
            this.readyPromise = this.spawnAndInit();
          }
        });

        this.proc.stdin.write('uci\n');
      } catch (err) {
        reject(err);
      }
    });
  }

  public async search(fen: string, opts: SearchOptions = {}): Promise<SearchResult> {
    if (this.isTerminated) {
      throw new Error('Stockfish engine is terminated');
    }

    if (this.readyPromise) {
      await this.readyPromise;
    }

    return new Promise<SearchResult>((resolve, reject) => {
      this.queue.push({ fen, opts, resolve, reject });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.busy || this.queue.length === 0 || !this.proc) return;

    this.busy = true;
    const req = this.queue.shift()!;
    this.currentReq = req;
    this.currentCandidates = new Map();

    // 5 seconds search timeout protection
    req.timeoutTimer = setTimeout(() => {
      if (this.currentReq === req) {
        console.warn('[Stockfish] Search timed out, sending stop');
        this.proc?.stdin.write('stop\n');
      }
    }, 5000);

    const skillLevel = Math.max(0, Math.min(20, optsSkillLevel(req.opts)));
    const multiPv = Math.max(1, Math.min(4, req.opts.multiPv ?? 3));
    const depth = Math.max(1, Math.min(20, req.opts.depth ?? 8));

    this.proc.stdin.write(`setoption name Skill Level value ${skillLevel}\n`);
    this.proc.stdin.write(`setoption name MultiPV value ${multiPv}\n`);

    if (req.opts.elo && req.opts.elo >= 1320) {
      this.proc.stdin.write('setoption name UCI_LimitStrength value true\n');
      const sfElo = Math.max(1320, Math.min(3190, Math.round(req.opts.elo)));
      this.proc.stdin.write(`setoption name UCI_Elo value ${sfElo}\n`);
    } else {
      this.proc.stdin.write('setoption name UCI_LimitStrength value false\n');
    }

    this.proc.stdin.write(`position fen ${req.fen}\n`);

    if (req.opts.movetime) {
      this.proc.stdin.write(`go movetime ${req.opts.movetime}\n`);
    } else {
      this.proc.stdin.write(`go depth ${depth}\n`);
    }
  }

  private handleLine(line: string): void {
    if (!this.currentReq) return;

    const trimmed = line.trim();

    if (trimmed.startsWith('info depth')) {
      const mpvMatch = trimmed.match(/multipv\s+(\d+)/);
      const depthMatch = trimmed.match(/depth\s+(\d+)/);
      const scoreCpMatch = trimmed.match(/score\s+cp\s+(-?\d+)/);
      const scoreMateMatch = trimmed.match(/score\s+mate\s+(-?\d+)/);
      const pvMatch = trimmed.match(/\bpv\s+([a-h1-8qrbn]+)/);

      if (mpvMatch && pvMatch) {
        const mpvIdx = parseInt(mpvMatch[1], 10);
        const depth = depthMatch ? parseInt(depthMatch[1], 10) : 1;
        const uciMove = pvMatch[1];
        let score = 0;

        if (scoreMateMatch) {
          const mateIn = parseInt(scoreMateMatch[1], 10);
          score = mateIn > 0 ? 90000 - mateIn * 10 : -90000 - mateIn * 10;
        } else if (scoreCpMatch) {
          score = parseInt(scoreCpMatch[1], 10);
        }

        const pvFull = trimmed.includes(' pv ') ? trimmed.slice(trimmed.indexOf(' pv ') + 4).trim() : uciMove;

        this.currentCandidates.set(mpvIdx, {
          uci: uciMove,
          score,
          depth,
          pv: pvFull,
          multipv: mpvIdx,
        });
      }
    } else if (trimmed.startsWith('bestmove')) {
      if (this.currentReq.timeoutTimer) {
        clearTimeout(this.currentReq.timeoutTimer);
      }

      const parts = trimmed.split(/\s+/);
      const bestUci = parts[1] || '';

      const candidates = [...this.currentCandidates.values()].sort((a, b) => a.multipv - b.multipv);

      // If no candidates parsed from info lines (rare edge case), create one from bestmove
      if (candidates.length === 0 && bestUci && bestUci !== '(none)') {
        candidates.push({
          uci: bestUci,
          score: 0,
          depth: 1,
          pv: bestUci,
          multipv: 1,
        });
      }

      const req = this.currentReq;
      this.currentReq = null;
      this.busy = false;

      req.resolve({
        bestmove: bestUci,
        candidates,
      });

      this.processQueue();
    }
  }

  public quit(): void {
    this.isTerminated = true;
    if (this.proc) {
      try {
        this.proc.stdin.write('quit\n');
        this.proc.kill();
      } catch {
        // ignore
      }
      this.proc = null;
    }
  }
}

function optsSkillLevel(opts: SearchOptions): number {
  if (opts.skillLevel !== undefined) return opts.skillLevel;
  if (opts.elo !== undefined) {
    if (opts.elo < 700) return 2;
    if (opts.elo < 900) return 4;
    if (opts.elo < 1075) return 6;
    if (opts.elo < 1250) return 8;
    if (opts.elo < 1425) return 10;
    if (opts.elo < 1575) return 12;
    if (opts.elo < 1725) return 14;
    if (opts.elo < 1875) return 16;
    if (opts.elo < 2025) return 18;
    if (opts.elo < 2200) return 19;
    return 20;
  }
  return 8;
}

export const stockfish = new StockfishEngine();
