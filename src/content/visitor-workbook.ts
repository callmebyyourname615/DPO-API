import { stream } from 'exceljs';
import { Writable } from 'node:stream';

interface VisitorWorkbookRow {
  occurredAt: Date;
  visitor: string;
  country: string;
  path: string;
  title: string;
  device: string;
  browser: string;
  os: string;
  source: string;
}

export async function visitorWorkbook(rows: VisitorWorkbookRow[]): Promise<Buffer> {
  const chunks: Buffer[] = [];
  const output = new Writable({ write(chunk, _encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
  const workbook = new stream.xlsx.WorkbookWriter({ stream: output, useStyles: true, useSharedStrings: false });
  workbook.creator = 'DPO';
  const sheet = workbook.addWorksheet('Visitors', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false, activeCell: 'A2' }],
    properties: { defaultRowHeight: 30 },
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });
  sheet.columns = [
    { header: 'Date & time', key: 'occurredAt', width: 23 },
    { header: 'Visitor', key: 'visitor', width: 17 },
    { header: 'Country', key: 'country', width: 22 },
    { header: 'Page', key: 'path', width: 44 },
    { header: 'Title', key: 'title', width: 58 },
    { header: 'Device', key: 'device', width: 14 },
    { header: 'Browser', key: 'browser', width: 21 },
    { header: 'OS', key: 'os', width: 19 },
    { header: 'Source', key: 'source', width: 32 },
  ];
  sheet.columns.forEach(column => {
    column.font = { name: 'Noto Sans Lao', size: 11, color: { argb: 'FF172033' } };
    column.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true, indent: 1 };
  });
  sheet.getColumn('occurredAt').numFmt = 'dd/mm/yyyy hh:mm:ss';
  sheet.autoFilter = { from: 'A1', to: `I${Math.max(1,rows.length + 1)}` };
  sheet.pageSetup.printTitlesRow = '1:1';
  const header = sheet.getRow(1);
  header.height = 34;
  header.eachCell(cell => {
    cell.font = { name: 'Noto Sans Lao', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF10218B' } };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FFDDE3EC' } } };
  });
  header.commit();
  const countries = new Intl.DisplayNames(['en'], { type: 'region' });
  for (const item of rows) {
    // Excel dates have no timezone; write the same Vientiane wall time as the monitor.
    const row = sheet.addRow({ ...item, occurredAt: new Date(item.occurredAt.getTime() + 7 * 3600000), country: item.country === 'ZZ' ? 'Unknown' : countries.of(item.country) || item.country, device: item.device === 'unknown' ? 'Unknown' : item.device.charAt(0).toUpperCase() + item.device.slice(1) });
    row.height = Math.max(30, Math.ceil(Math.max(item.path.length / 40,item.title.length / 50,item.source.length / 28)) * 20 + 10);
    if (row.number % 2 === 0) row.eachCell(cell => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } }; });
    row.commit();
  }
  sheet.commit();
  await workbook.commit();
  return Buffer.concat(chunks);
}
