/**
 * The oracle's worker. It answers on the port it is given and raises the flag
 * in the shared buffer, which is what releases the thread waiting on it.
 */
import { parentPort, type MessagePort } from 'node:worker_threads';

import { answer, type Request } from './oracle';

type Init = { port: MessagePort; shared: SharedArrayBuffer };

parentPort?.once('message', (init: Init) => {
  const flag = new Int32Array(init.shared);
  const port = init.port as unknown as {
    on(event: 'message', listener: (message: Request & { id: number }) => void): void;
    postMessage(value: unknown): void;
  };

  port.on('message', (request) => {
    answer(request)
      .then((reply) => {
        port.postMessage({ id: request.id, reply });
      })
      .catch((error: Error) => {
        port.postMessage({ id: request.id, reply: { ok: false, reason: error.message } });
      })
      .finally(() => {
        Atomics.store(flag, 0, 1);
        Atomics.notify(flag, 0);
      });
  });
});
