import { resolve } from 'path';
import { Printer } from './virtual-printer/printer/printer.js';
import mustacheExpress from 'mustache-express';
import { static as expressStatic } from 'express';
import { mkdirSync, writeFileSync } from 'fs';

export enum FileType {
  PDF = 'application/pdf',
  POSTSCRIPT = 'application/postscript',
}

export const frontPrinterServer = new Printer({
  name: 'FILTER_PRINTER',
  description: 'FILTER_PRINTER',
  bonjour: false,
  format: [FileType.POSTSCRIPT],
  serverUrl: new URL('http://0.0.0.0:3000'),
});

frontPrinterServer.on('server-opened', (error) =>
  !error ? null : console.error(error),
);

mkdirSync(resolve('jobs/'), {
  recursive: true,
});

frontPrinterServer.on('data', async (handledJob, _, request) => {
  let buffer = request.body as Buffer;
  const createdAt = new Date(handledJob.createdAt);
  const jobId = handledJob['job-id'];
  const filename = `${handledJob.createdAt}-${jobId}`;
  console.log(
    `job saved in "jobs/${filename}": jobId ${jobId} createdAt ${createdAt}`,
  );
  // check it is ufr (end_byte 03, CDCA101000)
  const index = buffer.indexOf('03CDCA101000', 0, 'hex') + 1;
  buffer = buffer.subarray(index);
  writeFileSync(resolve(`jobs/`, filename + '.ufr'), buffer);
});

frontPrinterServer.server.engine('mustache', mustacheExpress());
frontPrinterServer.server.engine(
  'mustache',
  mustacheExpress(resolve('packages/client/views/partials/'), '.mustache'),
);
frontPrinterServer.server.set('view engine', 'mustache');
frontPrinterServer.server.set('views', resolve('views/'));
frontPrinterServer.server.use('/static', expressStatic(resolve('public/')));
