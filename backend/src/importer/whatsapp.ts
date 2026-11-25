export type Msg = {
  date: Date;
  time: string;
  sender: string;
  text: string;
};

const HEADER_PATTERNS = [
  // WhatsApp Android/iOS: [2/11/26, 20:01:00] Nombre: mensaje
  /^\[(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})(?::\d{2})?\]\s(.+?):\s?(.*)$/,
  // Exportación de escritorio: 2/11/26 20:01 - Nombre: mensaje
  /^(\d{1,2})\/(\d{1,2})\/(\d{2,4}),?\s+(\d{1,2}):(\d{2})\s-\s(.+?):\s?(.*)$/,
];

function buildMessage(match: RegExpMatchArray): Msg {
  const [, day, month, rawYear, hour, minute, rawSender, body] = match;
  const year = Number(rawYear) < 100 ? 2000 + Number(rawYear) : Number(rawYear);
  return {
    // Mediodía local evita que la conversión ISO cambie el día por zona horaria.
    date: new Date(year, Number(month) - 1, Number(day), 12, 0, 0),
    time: `${hour.padStart(2, "0")}:${minute}`,
    sender: rawSender.replace(/[\u200e\u200f\u202a-\u202e]/g, "").trim(),
    text: body.trim(),
  };
}

export function parseChat(source: string): Msg[] {
  const messages: Msg[] = [];

  for (const rawLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = rawLine.replace(/^\uFEFF/, "");
    const match = HEADER_PATTERNS.map((pattern) => line.match(pattern)).find(Boolean);

    if (match) {
      messages.push(buildMessage(match));
      continue;
    }

    // Las líneas siguientes pertenecen al mensaje anterior: se conserva el salto real.
    if (messages.length > 0 && rawLine.length > 0) {
      messages[messages.length - 1].text += `\n${rawLine}`;
    }
  }

  return messages;
}
