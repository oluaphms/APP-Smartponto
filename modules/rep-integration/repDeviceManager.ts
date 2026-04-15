/**
 * Registro de adaptadores por fabricante (Control iD, Henry, Topdata, etc.)
 * O acesso HTTP ao hardware fica em repDeviceServer (servidor) e repDeviceBrowser (proxy /api/rep).
 */

import type { RepDevice, RepVendorAdapter } from './types';

const vendorAdapters: Map<string, RepVendorAdapter> = new Map();

export function registerVendorAdapter(fabricante: string, adapter: RepVendorAdapter): void {
  vendorAdapters.set(fabricante.toLowerCase(), adapter);
}

export function getVendorAdapter(device: RepDevice): RepVendorAdapter | null {
  if (!device.fabricante) return null;
  return vendorAdapters.get(device.fabricante.toLowerCase()) || null;
}
