import { Printer } from '../printer/printer.js';
import * as ipp from 'ipp';
import {
  getJobs,
  getPrinterAttributes,
  printJob,
  validateJob,
} from './handle-request.js';
import { getResponder, ServiceEvent } from '@homebridge/ciao';
import { ParsedBodyInterface } from './interfaces/parsed-body.js';
import { createServer } from 'http';
import { chmodSync } from 'fs';

export function openServer(printer: Printer) {
  printer.server.post('*', (req, res) => {
    const buffers: Buffer[] = [];
    req
      .on('data', (chunk) => {
        buffers.push(Buffer.from(chunk));
      })
      .on('end', () => {
        req.body = Buffer.concat(buffers);
        let body = {} as ParsedBodyInterface;
        try {
          body = ipp.parse(req.body) as ParsedBodyInterface;
        } catch (e) {
          console.error(e);
        }
        res.header('Content-Type', 'application/ipp');
        let data: Buffer;
        switch (body.operation) {
          case 'Print-Job':
            data = printJob(printer, req, body);
            break;
          case 'Get-Jobs':
            data = getJobs(printer, body);
            break;
          case 'Get-Printer-Attributes':
            data = getPrinterAttributes(printer, body);
            break;
          case 'Validate-Job':
            data = validateJob(printer, body);
            break;
          default: {
            data = ipp.serialize({
              id: body.id,
              version: '1.0',
              statusCode: 'server-error-operation-not-supported',
              'operation-attributes-tag': {
                'attributes-charset': 'utf-8',
                'attributes-natural-language': 'en-us',
              },
            });
            break;
          }
        }
        res.send(data);
      });
  });

  if (printer.printerOption.serverUrl instanceof URL) {
    printer.server
      .listen(
        Number(printer.printerOption.serverUrl.port),
        printer.printerOption.serverUrl.hostname,
      )
      .on('error', (err) => {
        printer.emit('server-opened', err);
      });
  } else {
    createServer(printer.server)
      .listen(printer.printerOption.serverUrl)
      .on('listening', () => {
        chmodSync(printer.printerOption.serverUrl, '777');
      })
      .on('error', (err) => {
        printer.emit('server-opened', err);
      });
  }

  if (
    printer.printerOption.serverUrl instanceof URL ||
    printer.printerOption.bonjour
  ) {
    const responder = getResponder();
    const service = responder.createService({
      name: printer.printerOption.name,
      type: 'ipp',
      port: Number((printer.printerOption.serverUrl as URL).port),
    });
    service.on(ServiceEvent.NAME_CHANGED, (name) => {
      printer.printerOption.name = name;
      printer.emit('bonjour-name-change', name);
    });
    service.on(ServiceEvent.HOSTNAME_CHANGED, (name) =>
      printer.emit('bonjour-hostname-change', name),
    );
    return service.advertise().then(() => printer.emit('bonjour-published'));
  }
}
