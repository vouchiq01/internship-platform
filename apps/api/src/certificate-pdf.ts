import { PDFDocument, StandardFonts, rgb, type PDFFont } from 'pdf-lib';

export interface CertificatePdfArgs {
  studentName: string;
  trackTitle: string;
  certificateNumber: string;
  issuedAt: Date;
  verifyUrl: string;
}

// Landscape A4, in points.
const WIDTH = 841.89;
const HEIGHT = 595.28;

const INK = rgb(0.043, 0.039, 0.047);
const BONE = rgb(0.953, 0.933, 0.898);
const MUTED = rgb(0.42, 0.39, 0.34);
const ACCENT = rgb(0.431, 0.482, 1);

/**
 * The standard PDF fonts use WinAnsi encoding, which cannot represent most
 * non-Latin scripts. Rather than throwing on a name in Devanagari or Tamil,
 * drop what cannot be encoded and fall back if nothing survives — a student
 * must always receive a certificate.
 */
function toWinAnsi(value: string, fallback: string): string {
  const cleaned = value
    .normalize('NFC')
    .split('')
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 0x20 && code <= 0xff && code !== 0x7f;
    })
    .join('')
    .trim();
  return cleaned.length > 0 ? cleaned : fallback;
}

/** Shrinks a line until it fits the available width. */
function fitSize(font: PDFFont, text: string, maxWidth: number, start: number, min: number) {
  let size = start;
  while (size > min && font.widthOfTextAtSize(text, size) > maxWidth) size -= 2;
  return size;
}

export async function generateCertificatePdf(
  args: CertificatePdfArgs,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([WIDTH, HEIGHT]);

  const serif = await doc.embedFont(StandardFonts.TimesRoman);
  const serifItalic = await doc.embedFont(StandardFonts.TimesRomanItalic);
  const sans = await doc.embedFont(StandardFonts.Helvetica);

  const name = toWinAnsi(args.studentName, 'Certificate Holder');
  const track = toWinAnsi(args.trackTitle, 'Internship');

  // Bone field with an inked border, matching the on-screen certificate.
  page.drawRectangle({ x: 0, y: 0, width: WIDTH, height: HEIGHT, color: BONE });
  page.drawRectangle({
    x: 28, y: 28, width: WIDTH - 56, height: HEIGHT - 56,
    borderColor: INK, borderWidth: 1.2,
  });
  page.drawRectangle({
    x: 40, y: 40, width: WIDTH - 80, height: HEIGHT - 80,
    borderColor: MUTED, borderWidth: 0.4,
  });

  const centre = (text: string, font: PDFFont, size: number, y: number, color = INK) => {
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (WIDTH - w) / 2, y, size, font, color });
  };

  centre('CERTIFICATE OF COMPLETION', sans, 10, HEIGHT - 96, MUTED);
  centre('INTERNSHIP PLATFORM', sans, 8, HEIGHT - 114, MUTED);

  centre('This certifies that', serifItalic, 15, HEIGHT - 186, MUTED);

  const nameSize = fitSize(serif, name, WIDTH - 200, 52, 22);
  centre(name, serif, nameSize, HEIGHT - 250);

  // Rule under the name.
  const nameWidth = serif.widthOfTextAtSize(name, nameSize);
  const ruleWidth = Math.min(Math.max(nameWidth + 80, 260), WIDTH - 180);
  page.drawLine({
    start: { x: (WIDTH - ruleWidth) / 2, y: HEIGHT - 268 },
    end: { x: (WIDTH + ruleWidth) / 2, y: HEIGHT - 268 },
    thickness: 0.8,
    color: MUTED,
  });

  centre('has completed the', serifItalic, 15, HEIGHT - 306, MUTED);
  const trackSize = fitSize(serif, track, WIDTH - 240, 30, 16);
  centre(track, serif, trackSize, HEIGHT - 348);
  centre('track, including a project reviewed and approved by an assessor.', sans, 10, HEIGHT - 378, MUTED);

  // Footer: number on the left, verification on the right.
  const footY = 86;
  page.drawLine({
    start: { x: 80, y: footY + 46 },
    end: { x: WIDTH - 80, y: footY + 46 },
    thickness: 0.5,
    color: MUTED,
  });

  page.drawText('CERTIFICATE NO.', { x: 80, y: footY + 22, size: 7, font: sans, color: MUTED });
  page.drawText(args.certificateNumber, { x: 80, y: footY + 6, size: 11, font: sans, color: INK });

  const issued = args.issuedAt.toISOString().slice(0, 10);
  page.drawText('ISSUED', { x: 80, y: footY - 22, size: 7, font: sans, color: MUTED });
  page.drawText(issued, { x: 80, y: footY - 38, size: 11, font: sans, color: INK });

  const verifyLabel = 'VERIFY AT';
  const labelWidth = sans.widthOfTextAtSize(verifyLabel, 7);
  page.drawText(verifyLabel, {
    x: WIDTH - 80 - labelWidth, y: footY + 22, size: 7, font: sans, color: MUTED,
  });

  const urlSize = fitSize(sans, args.verifyUrl, 340, 10, 6);
  const urlWidth = sans.widthOfTextAtSize(args.verifyUrl, urlSize);
  page.drawText(args.verifyUrl, {
    x: WIDTH - 80 - urlWidth, y: footY + 6, size: urlSize, font: sans, color: ACCENT,
  });

  const note = 'This certificate can be verified online by anyone, without an account.';
  const noteWidth = sans.widthOfTextAtSize(note, 7);
  page.drawText(note, {
    x: WIDTH - 80 - noteWidth, y: footY - 38, size: 7, font: sans, color: MUTED,
  });

  doc.setTitle(`Certificate ${args.certificateNumber}`);
  doc.setSubject(`${track} track — Internship Platform`);
  doc.setAuthor('Internship Platform');
  doc.setProducer('Internship Platform');
  doc.setCreationDate(args.issuedAt);

  return doc.save();
}
