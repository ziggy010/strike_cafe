/**
 * NepalPay / EMVCo merchant-QR helpers.
 *
 * Nepal's interoperable QR standard (NepalPay, used by eSewa, Khalti, FonePay,
 * and the banks) follows the EMVCo Merchant-Presented QR spec: a string of
 * Tag-Length-Value fields ending in a CRC-16 checksum.
 *
 * A café already has a *static* merchant QR (amount typed by the payer). We turn
 * it into a *dynamic* QR by injecting the bill amount (tag 54) and a remark
 * (tag 62), then recomputing the checksum. Because we reuse the café's own
 * merchant fields, the money still routes to their account — the customer just
 * doesn't have to type the amount.
 */

/**
 * EMVCo CRC-16/CCITT-FALSE: poly 0x1021, init 0xFFFF, no reflect, no xor-out.
 * Computed over the UTF-8 bytes of the payload (verified against the EMVCo spec
 * example, which yields A13A).
 */
export function crc16(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let crc = 0xffff;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function tlv(tag: string, value: string): string {
  return `${tag}${value.length.toString().padStart(2, "0")}${value}`;
}

interface Field {
  tag: string;
  value: string;
}

/** Parse a flat EMVCo TLV string. Returns [] if it doesn't look like one. */
export function parseEmv(s: string): Field[] {
  const out: Field[] = [];
  let i = 0;
  while (i + 4 <= s.length) {
    const tag = s.slice(i, i + 2);
    const len = parseInt(s.slice(i + 2, i + 4), 10);
    if (Number.isNaN(len) || i + 4 + len > s.length) return [];
    out.push({ tag, value: s.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

/** Does this string look like a valid NepalPay / EMVCo merchant QR? */
export function looksLikeEmvQr(s: string): boolean {
  const fields = parseEmv(s.trim());
  if (fields.length < 3) return false;
  const map = new Map(fields.map((f) => [f.tag, f.value]));
  // Payload format indicator + at least one merchant-account template (26–51).
  if (map.get("00") !== "01") return false;
  return fields.some((f) => {
    const n = Number(f.tag);
    return n >= 26 && n <= 51;
  });
}

function formatAmount(amount: number): string {
  return (Math.round(amount * 100) / 100).toFixed(2);
}

/** Trim to EMVCo sub-field limits and drop characters that can't be encoded. */
function clean(text: string, max: number): string {
  return text.replace(/[^\x20-\x7E]/g, "").trim().slice(0, max);
}

/**
 * Turn a café's static merchant QR into a dynamic one carrying `amount` and a
 * `remark`. Returns null if the input isn't a usable EMVCo QR.
 */
export function buildDynamicNepalQr(
  staticQr: string,
  amount: number,
  remark: string,
  billNumber?: string,
): string | null {
  const trimmed = staticQr.trim();
  if (!looksLikeEmvQr(trimmed) || amount <= 0) return null;

  const map = new Map(parseEmv(trimmed).map((f) => [f.tag, f.value]));

  map.set("01", "12"); // point of initiation = dynamic
  map.set("54", formatAmount(amount)); // transaction amount

  // Additional data: bill number (01) + purpose/remark (08).
  const additional =
    (billNumber ? tlv("01", clean(billNumber, 25)) : "") + tlv("08", clean(remark, 25));
  if (additional) map.set("62", additional);

  // Rebuild in ascending tag order; CRC (63) is always computed last.
  const body = [...map.keys()]
    .filter((t) => t !== "63")
    .sort()
    .map((t) => tlv(t, map.get(t)!))
    .join("");

  const withCrcTag = `${body}6304`;
  return `${withCrcTag}${crc16(withCrcTag)}`;
}
