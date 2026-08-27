import { Injectable } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Injectable()
export class ReportExportProcessor {
  constructor(private readonly reporting: ReportingService) {}

  process(exportId: string) { return this.reporting.generateQueuedExport(exportId); }
}
