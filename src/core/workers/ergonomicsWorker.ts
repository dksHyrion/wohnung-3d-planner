import {
  processErgonomicsWorkerRequest,
  type ErgonomicsWorkerRequest,
} from './ergonomicsWorkerProtocol';

self.addEventListener('message', (event: MessageEvent<ErgonomicsWorkerRequest>) => {
  const response = processErgonomicsWorkerRequest(event.data);
  self.postMessage(response);
});
