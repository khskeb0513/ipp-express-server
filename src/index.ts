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
  serverUrl: new URL('http://127.0.0.1:3000'),
});

frontPrinterServer.on('server-opened', (error) =>
  !error ? null : console.error(error),
);

mkdirSync(resolve('jobs/'), {
  recursive: true,
});

frontPrinterServer.on('data', async (handledJob, data) => {
  const createdAt = new Date(handledJob.createdAt);
  const jobId = handledJob['job-id'];
  console.log(
    `job saved in "jobs/${jobId}-${handledJob.createdAt}": jobId ${jobId} createdAt ${createdAt}`,
  );
  return writeFileSync(resolve('jobs/'), data);
});

frontPrinterServer.server.engine('mustache', mustacheExpress());
frontPrinterServer.server.engine(
  'mustache',
  mustacheExpress(resolve('packages/client/views/partials/'), '.mustache'),
);
frontPrinterServer.server.set('view engine', 'mustache');
frontPrinterServer.server.set('views', resolve('views/'));
frontPrinterServer.server.use('/static', expressStatic(resolve('public/')));
