import { mkdir, writeFile } from 'node:fs/promises';
import { inflateRawSync, crc32 } from 'node:zlib';
import assert from 'node:assert/strict';

assert.equal(process.platform, 'win32', 'This optional download optimization is for Windows; use mongodb-memory-server normally elsewhere.');
const url = 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-7.0.24.zip';
async function range(start, end) {
  const response = await fetch(url, { headers: { Range: `bytes=${start}-${end}` }, signal: AbortSignal.timeout(120000) });
  assert.equal(response.status, 206, 'Official download must support byte ranges.');
  return Buffer.from(await response.arrayBuffer());
}
const head = await fetch(url, { method: 'HEAD' });
assert(head.ok);
const length = Number(head.headers.get('content-length'));
assert(Number.isSafeInteger(length) && length > 65557);
const tail = await range(length - 65557, length - 1);
const end = tail.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
assert(end >= 0);
const directorySize = tail.readUInt32LE(end + 12);
const directoryStart = tail.readUInt32LE(end + 16);
const directory = await range(directoryStart, directoryStart + directorySize - 1);
let entry;
for (let offset = 0; offset < directory.length;) {
  assert.equal(directory.readUInt32LE(offset), 0x02014b50);
  const nameLength = directory.readUInt16LE(offset + 28);
  const name = directory.subarray(offset + 46, offset + 46 + nameLength).toString();
  if (name.endsWith('/bin/mongod.exe')) entry = { offset: directory.readUInt32LE(offset + 42), compressed: directory.readUInt32LE(offset + 20), size: directory.readUInt32LE(offset + 24), crc: directory.readUInt32LE(offset + 16), method: directory.readUInt16LE(offset + 10) };
  offset += 46 + nameLength + directory.readUInt16LE(offset + 30) + directory.readUInt16LE(offset + 32);
}
assert(entry, 'mongod.exe not found in the official archive.');
assert.equal(entry.method, 8);
const header = await range(entry.offset, entry.offset + 29);
const start = entry.offset + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
console.log(`Downloading only the official mongod test executable (${Math.ceil(entry.compressed / 1048576)} MB compressed), not debugging symbols/tools.`);
const chunks = [];
for (let offset = 0; offset < entry.compressed; offset += 4 * 1048576) chunks.push(await range(start + offset, start + Math.min(entry.compressed, offset + 4 * 1048576) - 1));
const executable = inflateRawSync(Buffer.concat(chunks));
assert.equal(executable.length, entry.size); assert.equal(crc32(executable), entry.crc);
await mkdir('.cache', { recursive: true }); await writeFile('.cache/mongod.exe', executable);
console.log('Official HTTPS archive entry size and CRC verified. Test executable saved in ignored .cache/mongod.exe.');
