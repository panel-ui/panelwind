/**
 * The synchronous face of the oracle.
 *
 * An ESLint rule runs synchronously and Tailwind's loader does not, so the
 * work happens in a worker and this thread waits on a shared flag for the
 * answer. The alternative — no oracle — means guessing at which classes exist,
 * and a linter that guesses about the thing it is most trusted on is worse
 * than no linter.
 *
 * Failure is contained: a theme that cannot be built is reported once and the
 * rules that need it stand down, rather than failing the run.
 */
import * as fs from 'node:fs';
import { MessageChannel, receiveMessageOnPort, Worker, type MessagePort } from 'node:worker_threads';

import { modifiedAt } from '../project/fs';
import { warnOnce } from '../project/warn';
import type { Reply } from './oracle';

type Bridge = { worker: Worker; port: MessagePort; flag: Int32Array; nextId: number; cold: boolean };

/** null: not started. false: off for this process. */
let bridge: Bridge | null | false = null;
let restarts = 0;

const FIRST_TIMEOUT = 20_000;
const TIMEOUT = 5_000;

const answers = new Map<string, string | null>();
const classLists = new Map<string, string[]>();

function workerFile(): URL | null {
  const candidates = [new URL('./native-worker.js', import.meta.url)];
  // Running from source, the built worker is the one that exists.
  if (/\/src\/native\/[^/]+$/.test(import.meta.url)) {
    candidates.push(new URL('../../dist/native-worker.js', import.meta.url));
  }
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // Not a file URL; keep looking.
    }
  }
  return null;
}

function start(): Bridge | null {
  const file = workerFile();
  if (!file) {
    warnOnce('native:worker-missing', 'the native oracle’s worker is missing; build the package.');
    bridge = false;
    return null;
  }
  const shared = new SharedArrayBuffer(4);
  const flag = new Int32Array(shared);
  const worker = new Worker(file);
  const channel = new MessageChannel();
  worker.postMessage({ port: channel.port2, shared }, [channel.port2]);
  worker.unref();
  channel.port1.unref();
  const started: Bridge = { worker, port: channel.port1, flag, nextId: 1, cold: true };
  bridge = started;
  return started;
}

function stop() {
  if (bridge) void bridge.worker.terminate();
  bridge = null;
}

function transportFailed(reason: string) {
  stop();
  if (restarts++ >= 1) {
    bridge = false;
    warnOnce(
      'native:off',
      `the native oracle stopped answering (${reason}); no-unknown-classes and no-web-only-classes are standing down for this run.`
    );
  }
  return null;
}

function ask(entry: string, tokens: string[]): Reply | null {
  if (bridge === false) return null;
  const active = bridge ?? start();
  if (!active) return null;

  const id = active.nextId++;
  Atomics.store(active.flag, 0, 0);
  try {
    active.port.postMessage({ id, entry, tokens });
  } catch (error) {
    return transportFailed((error as Error).message);
  }

  const timeout = active.cold ? FIRST_TIMEOUT : TIMEOUT;
  const waited = Atomics.wait(active.flag, 0, 0, timeout);
  if (waited === 'timed-out') return transportFailed('it took too long to answer');
  active.cold = false;

  const message = receiveMessageOnPort(active.port);
  if (!message) return transportFailed('no answer came back');
  const { reply } = message.message as { id: number; reply: Reply };
  restarts = 0;
  return reply;
}

/**
 * What the project's Tailwind generates for these classes: a CSS string, or
 * null where it generates nothing. Returns null when the oracle is
 * unavailable, which every caller has to treat as "no opinion".
 */
export function cssFor(entry: string, tokens: string[]): Map<string, string | null> | null {
  const stamp = modifiedAt(entry) ?? 0;
  const results = new Map<string, string | null>();
  const missing: string[] = [];

  for (const token of tokens) {
    const key = `${entry}:${stamp}:${token}`;
    if (answers.has(key)) results.set(token, answers.get(key)!);
    else missing.push(token);
  }
  if (!missing.length) return results;

  const reply = ask(entry, missing);
  if (!reply) return results.size ? results : null;
  if (!reply.ok) {
    warnOnce(`native:${entry}`, `${reply.reason}; the class rules are standing down for this run.`);
    return null;
  }

  classLists.set(`${entry}:${stamp}`, reply.classes);
  missing.forEach((token, index) => {
    const css = reply.css[index] ?? null;
    answers.set(`${entry}:${stamp}:${token}`, css);
    results.set(token, css);
  });
  return results;
}

/** Every class this project's Tailwind can generate — the source of "did you mean". */
export function classListFor(entry: string): string[] | null {
  const stamp = modifiedAt(entry) ?? 0;
  const cached = classLists.get(`${entry}:${stamp}`);
  if (cached) return cached;
  // Asking about one class loads the design system, and the list comes with it.
  cssFor(entry, ['flex']);
  return classLists.get(`${entry}:${stamp}`) ?? null;
}

/** Tests run several projects in one process. */
export function resetOracle() {
  answers.clear();
  classLists.clear();
  restarts = 0;
  stop();
}
