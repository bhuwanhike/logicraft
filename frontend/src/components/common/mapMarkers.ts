/**
 * Pure helpers for the Google Maps fleet layer.
 *
 * These are separated from {@link FleetMap} because they are the parts with
 * real logic and no DOM dependency: the popup builder interpolates API strings
 * into HTML, so its escaping is security-relevant, and the icon builder encodes
 * the heading convention. Both are worth testing without a browser or an API
 * key.
 */

import type { FleetMarker } from './FleetMap';
import type { GoogleMapsWindow } from '../../services/googleMaps';

/** Escapes text before it is interpolated into the popup's innerHTML. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the popup body.
 *
 * The Maps InfoWindow takes an HTML string, so this is the one place where an
 * API-supplied value reaches innerHTML. Every interpolated value goes through
 * {@link escapeHtml}; `label` and `details` both originate from the API.
 */
export function popupHtml(marker: FleetMarker): string {
  const rows: string[] = [];

  if (typeof marker.speedKph === 'number' && Number.isFinite(marker.speedKph)) {
    rows.push(`<span>Speed</span><b>${Math.round(marker.speedKph)} km/h</b>`);
  }

  for (const detail of marker.details ?? []) {
    const separator = detail.indexOf(':');
    if (separator > 0) {
      const label = detail.slice(0, separator);
      // The separator is consumed, so the leading space the caller wrote after
      // the colon has to be dropped or every value renders indented.
      const value = detail.slice(separator + 1).trim();
      rows.push(`<span>${escapeHtml(label)}</span><b>${escapeHtml(value)}</b>`);
    } else {
      rows.push(`<span></span><b>${escapeHtml(detail)}</b>`);
    }
  }

  return `
    <div class="gm-popup">
      <b>${escapeHtml(marker.label)}</b>
      ${rows.length ? `<div class="gm-popup-rows">${rows.join('')}</div>` : ''}
    </div>`;
}

/** Pin colour by tone. Delayed trips read red so they stand out in transit. */
export function pinColour(tone?: string): string {
  return tone === 'warn' ? '#c0392b' : '#2f6ada';
}

/**
 * Builds a rotated truck pin, or `undefined` to use the SDK default marker.
 *
 * `heading` is a compass bearing in degrees, which is also what the Maps SDK
 * expects for `Symbol.rotation`, so no conversion is applied. A missing or
 * non-numeric heading returns undefined rather than rotating to 0, which would
 * point every heading-less truck due north and imply a direction it has none of.
 *
 * The enum is `google.maps.SymbolPath`. There is no `google.maps.symbol`
 * namespace on this loader, and a classic `Marker` symbol takes no `anchor`
 * (that property belongs to AdvancedMarkerElement); the classic marker centres
 * the symbol on the position by itself.
 *
 * Any problem resolving the enum yields `undefined` rather than throwing: an
 * exception here escapes the effect, unmounts the panel, and reproduces the
 * blank map this code originally caused.
 */
export function buildMarkerIcon(
  google: GoogleMapsWindow,
  marker: FleetMarker
): unknown {
  const heading = Number(marker.heading);
  if (marker.heading === null || marker.heading === undefined || !Number.isFinite(heading)) {
    return undefined;
  }
  const closedArrow = google.maps.SymbolPath?.FORWARD_CLOSED_ARROW;
  if (closedArrow === undefined) return undefined;

  return {
    path: closedArrow,
    scale: 5,
    fillColor: pinColour(marker.tone),
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 1.5,
    rotation: heading
  };
}

/**
 * Stable identity for a marker, used to reconcile the marker layer.
 *
 * Markers are keyed by id so a telemetry poll moves the existing pin instead of
 * destroying and recreating it, which would close an open popup and drop the
 * click target mid-interaction.
 */
export function markerKey(marker: FleetMarker): string {
  return marker.id ?? `${marker.lat},${marker.lng}`;
}

/** True when a marker has usable coordinates. */
export function hasCoordinates(marker: FleetMarker): boolean {
  return Number.isFinite(marker.lat) && Number.isFinite(marker.lng);
}
