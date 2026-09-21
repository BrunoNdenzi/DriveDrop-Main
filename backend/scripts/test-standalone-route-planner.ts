import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import {
  normalizeRecurrence,
  normalizeStops,
  parseImportRows,
} from '../src/routes/standaloneRoutePlanner.routes';

async function main(): Promise<void> {
  const stops = normalizeStops([
    { name: 'Depot', address: '100 Main St, Charlotte, NC' },
    { name: 'Customer', address: '200 Trade St, Charlotte, NC', serviceMinutes: 20 },
  ]);
  assert.equal(stops[0]?.type, 'current_location');
  assert.equal(stops[1]?.type, 'stop');
  assert.equal(stops[1]?.estimatedDuration, 20);

  const csvRows = await parseImportRows(undefined, 'name,address,service_minutes\nDepot,"100 Main St, Charlotte, NC",0\nCustomer,"200 Trade St, Charlotte, NC",15');
  assert.equal(csvRows.length, 2);
  assert.equal(csvRows[1]?.['address'], '200 Trade St, Charlotte, NC');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Stops');
  worksheet.addRow(['name', 'address', 'service_minutes']);
  worksheet.addRow(['Warehouse', '300 South Blvd, Charlotte, NC', 25]);
  const workbookData = await workbook.xlsx.writeBuffer();
  const xlsxRows = await parseImportRows({
    originalname: 'route.xlsx',
    buffer: Buffer.from(workbookData),
  } as Express.Multer.File, undefined);
  assert.equal(xlsxRows.length, 1);
  assert.equal(xlsxRows[0]?.['name'], 'Warehouse');
  assert.equal(xlsxRows[0]?.['service_minutes'], '25');

  const startsAt = new Date(Date.now() + 60 * 60 * 1000);
  const schedule = normalizeRecurrence({
    frequency: 'weekly',
    interval: 2,
    weekdays: [startsAt.getUTCDay()],
    startsAt: startsAt.toISOString(),
  });
  assert.equal(schedule.recurrence?.interval, 2);
  assert.equal(schedule.nextRunAt, startsAt.toISOString());

  assert.throws(
    () => normalizeStops([{ address: 'Only one stop' }]),
    /between 2 and 100 stops/
  );

  console.log('Standalone planner stop, recurrence, CSV, and XLSX checks passed.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});