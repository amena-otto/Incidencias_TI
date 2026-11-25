import assert from "node:assert/strict";
import { parseChat } from "../importer/whatsapp.js";
import { classify } from "./rules.js";

const chat = [
  "2/11/26 20:01 - Docente A: No tengo conexión a Internet",
  "6/11/26 13:48 - MARIA PAREDES: No logré firmar mi salida",
  "6/11/26 13:49 - Roger Mori Curwen: Buenas tardes miss, se verifica",
  "6/11/26 13:55 - OTTO TONSMANN: Listo miss, se verificó y se regularizó su marcación",
  "7/11/26 09:00 - Docente B: Buen día",
  "Necesito apoyo técnico.",
  "No puedo ingresar al sistema.",
  "7/11/26 09:01 - OTTO TONSMANN: Me estoy acercando",
].join("\n");

const messages = parseChat(chat);
assert.equal(messages.length, 6, "Debe reconocer mensajes y conservar multilínea");
assert.match(messages[2].text, /se verifica/);
assert.match(messages[3].text, /regularizó/);

const candidates = classify(messages);
assert.equal(candidates[0].categoryLabel, "TI · Redes e Internet");
const attendance = candidates.find((row) => row.categoryLabel === "Asistencia · Marcación y asistencia");
assert.ok(attendance);
assert.equal(attendance.contextualization, "Regularización de marcación de salida hecha (06/11, 13:55).");
assert.ok(!candidates.some((row) => row.originalMessage.includes("se verifica")));
console.log("Clasificador V2: pruebas básicas correctas.");
