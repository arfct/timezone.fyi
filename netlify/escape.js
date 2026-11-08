// Escaping for text from the URL (labels, zone codes, error messages) before
// it goes into the page or the calendar file.

const HTML_ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

// For HTML text and attribute values
export const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c]);

// For an iCalendar TEXT value (RFC 5545, section 3.3.11)
export const escapeIcsText = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
