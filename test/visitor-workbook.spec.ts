import { Workbook, ValueType } from 'exceljs';
import { visitorWorkbook } from '../src/content/visitor-workbook';

const item = {
  occurredAt: new Date('2026-11-08T18:45:12Z'), visitor: '00001234abcd', country: 'LA',
  path: '/ຂ່າວສານ/', title: 'ຂ່າວສານ DPO', device: 'desktop', browser: 'Chrome', os: 'Windows', source: 'search.example',
};
describe('visitor XLSX export', () => {
  it('writes only a styled header and rows, preserving Unicode, text IDs, and local date/time', async () => {
    const bytes = await visitorWorkbook([item, { ...item, country: 'ZZ', title: '=HYPERLINK("https://example.test")' }]);
    expect(bytes.subarray(0,2).toString()).toBe('PK');
    const workbook = new Workbook();
    await workbook.xlsx.load(bytes as any);
    expect(workbook.worksheets).toHaveLength(1);
    const sheet = workbook.getWorksheet('Visitors')!;
    expect(sheet.rowCount).toBe(3);
    expect(sheet.getRow(1).values).toEqual([undefined, 'Date & time', 'Visitor', 'Country', 'Page', 'Title', 'Device', 'Browser', 'OS', 'Source']);
    expect(sheet.getCell('A2').value).toEqual(new Date('2026-11-09T01:45:12Z'));
    expect(sheet.getCell('A2').numFmt).toBe('dd/mm/yyyy hh:mm:ss');
    expect(sheet.getCell('B2').value).toBe('00001234abcd');
    expect(sheet.getCell('C2').value).toBe('Laos');
    expect(sheet.getCell('C3').value).toBe('Unknown');
    expect(sheet.getCell('D2').value).toBe(item.path);
    expect(sheet.getCell('E2').value).toBe(item.title);
    expect(sheet.getCell('E3').type).toBe(ValueType.String);
    expect(sheet.getCell('E3').value).toBe('=HYPERLINK("https://example.test")');
    expect(sheet.getCell('E3').formula).toBeUndefined();
    expect(sheet.views[0]).toEqual(expect.objectContaining({state:'frozen',ySplit:1,showGridLines:false}));
    expect(sheet.autoFilter).toBe('A1:I3');
    expect(sheet.getCell('A1').font.bold).toBe(true);
    expect(sheet.getCell('A1').fill).toEqual(expect.objectContaining({fgColor:{argb:'FF10218B'}}));
    expect(sheet.getCell('A2').fill).toEqual(expect.objectContaining({fgColor:{argb:'FFF5F7FA'}}));
    expect(sheet.getColumn(5).width).toBe(58);
  });
  it('writes a valid header-only workbook for an empty filtered export', async () => {
    const workbook = new Workbook(); await workbook.xlsx.load(await visitorWorkbook([]) as any);
    expect(workbook.getWorksheet('Visitors')!.rowCount).toBe(1);
    expect(workbook.getWorksheet('Visitors')!.autoFilter).toBe('A1:I1');
  });
  it('wraps long content with enough row height', async () => {
    const workbook = new Workbook();
    await workbook.xlsx.load(await visitorWorkbook([{...item,path:'/'+ 'a'.repeat(490),title:'ຂ່າວ'.repeat(40)}]) as any);
    const sheet = workbook.getWorksheet('Visitors')!;
    expect(sheet.getCell('D2').alignment.wrapText).toBe(true);
    expect(sheet.getRow(2).height).toBeGreaterThan(200);
  });
});
