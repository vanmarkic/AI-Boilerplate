import { Protocol } from 'pmtiles';
import { addProtocol } from 'maplibre-gl';

let registered = false;

/** Register the pmtiles:// protocol with MapLibre (idempotent). */
export function registerPmtilesProtocol(): void {
  if (registered) return;
  const protocol = new Protocol();
  addProtocol('pmtiles', protocol.tile);
  registered = true;
}
