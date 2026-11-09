export const adminRuntime = { generation: 0, urls: new Set(), locks: new Set() };
export function resetAdmin() {
  adminRuntime.generation++;
  adminRuntime.locks.clear();
  adminRuntime.urls.forEach(url => URL.revokeObjectURL(url));
  adminRuntime.urls.clear();
}
