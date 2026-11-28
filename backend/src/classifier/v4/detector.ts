import { OTHER_CATEGORY } from "../categories.js";
import { containsPhrase, isNegation, normalizeForAnalysis, phraseTokens } from "./normalize.js";
import {
  type Concept,
  type ConceptMatch,
  type DetectionResult,
  type DictionarySnapshot,
  type MatchKind,
} from "./types.js";

const MULTIPLIER: Record<MatchKind, number> = {
  expresion: 1,
  sinonimo: 0.7,
  variante: 0.9,
  abreviatura: 0.9,
  relacionado: 0.4,
  ventana: 0.6,
};

function multiplierFor(kind: MatchKind, term: string): number {
  return kind !== "expresion" && CONTEXT_ONLY.has(term) ? 0.15 : MULTIPLIER[kind];
}

const STOPWORDS = new Set(["el", "la", "los", "las", "un", "una", "de", "del", "en", "y", "o", "para", "por", "mi", "su", "se", "no", "sin", "hay", "tengo", "necesito", "requiero", "solicito"]);

/** Términos de ubicación/contexto: apoyan, pero no definen una categoría. */
const CONTEXT_ONLY = new Set(["aula", "salon", "sala", "laboratorio", "lab", "auditorio", "oficina", "pasillo", "piso", "estudiantes", "clase", "hoy", "viernes", "evento", "blanco", "hojas", "cursor"]);

type TermEntry = { term: string; kind: MatchKind };

function firstIndexOf(tokens: readonly string[], term: string): number {
  const needle = phraseTokens(term);
  if (!needle.length || needle.length > tokens.length) return -1;
  for (let index = 0; index <= tokens.length - needle.length; index += 1) {
    if (needle.every((token, offset) => tokens[index + offset] === token)) return index;
  }
  return -1;
}

function negatedBefore(tokens: readonly string[], index: number, term: string): boolean {
  if (phraseTokens(term).some(isNegation)) return false;
  const start = Math.max(0, index - 3);
  return tokens.slice(start, index).some(isNegation);
}

function termEntries(concept: Concept): TermEntry[] {
  const entries: TermEntry[] = [];
  for (const term of concept.expressions) entries.push({ term, kind: "expresion" });
  for (const term of concept.variants) entries.push({ term, kind: "variante" });
  for (const term of concept.abbreviations) entries.push({ term, kind: "abreviatura" });
  for (const term of concept.synonyms) entries.push({ term, kind: "sinonimo" });
  for (const term of concept.related) entries.push({ term, kind: "relacionado" });
  return entries;
}

function windowMatches(concept: Concept, tokens: readonly string[], evidencePrefix: string): ConceptMatch[] {
  const terms = concept.related.map((term) => phraseTokens(term)).filter((parts) => parts.length === 1 && !STOPWORDS.has(parts[0]));
  const matches: ConceptMatch[] = [];
  for (let first = 0; first < terms.length && matches.length < 3; first += 1) {
    for (let second = first + 1; second < terms.length && matches.length < 3; second += 1) {
      const left = firstIndexOf(tokens, terms[first].join(" "));
      const right = firstIndexOf(tokens, terms[second].join(" "));
      if (left < 0 || right < 0 || Math.abs(left - right) > 4) continue;
      const negated = negatedBefore(tokens, left, terms[first].join(" "))
        || negatedBefore(tokens, right, terms[second].join(" "));
      const window = tokens.slice(Math.min(left, right), Math.max(left, right) + 1).join(" ");
      matches.push({
        conceptKey: concept.key,
        conceptName: concept.name,
        category: concept.category,
        matchedTerm: `${terms[first][0]} + ${terms[second][0]}`,
        kind: "ventana",
        weight: Number((concept.weight * Math.min(
          multiplierFor("ventana", terms[first][0]),
          multiplierFor("ventana", terms[second][0]),
        ) * (negated ? 0.85 : 1)).toFixed(2)),
        priority: concept.priority,
        position: Math.min(left, right),
        negated,
        evidence: `${evidencePrefix}; ventana de ${Math.abs(left - right) + 1} términos: «${window}»${negated ? " con negación de capacidad" : ""}`,
        window: tokens.slice(Math.max(0, Math.min(left, right) - 2), Math.min(tokens.length, Math.max(left, right) + 3)),
      });
    }
  }
  return matches;
}

function contextBonus(
  tokens: readonly string[],
  messages: readonly { text: string }[] | undefined,
  index: number | undefined,
): { score: number; evidence: string[] } {
  if (!messages || index === undefined) return { score: 0, evidence: [] };
  const evidence: string[] = [];
  let score = 0;
  for (const offset of [-1, 1]) {
    const neighbor = messages[index + offset];
    if (!neighbor) continue;
    const neighborTokens = normalizeForAnalysis(neighbor.text).tokens.filter((token) => !STOPWORDS.has(token));
    const shared = neighborTokens.filter((token) => tokens.includes(token));
    if (shared.length >= 2 && score < 1) {
      score += 0.5;
      evidence.push(`Contexto ${offset < 0 ? "anterior" : "posterior"} con términos compartidos: ${[...new Set(shared)].slice(0, 3).join(", ")}.`);
    }
  }
  return { score, evidence };
}

/** Evalúa conceptos, ventanas, negaciones y señales de contexto; todo queda explicado. */
export function detect(
  text: string,
  dictionary: DictionarySnapshot,
  context: { messages?: readonly { text: string }[]; index?: number } = {},
): DetectionResult | null {
  const normalized = normalizeForAnalysis(text);
  if (!normalized.tokens.length) return null;

  const byCategory = new Map<string, { score: number; matches: ConceptMatch[]; evidence: string[]; negatives: string[]; specificity: number }>();
  const bonus = contextBonus(normalized.tokens, context.messages, context.index);

  for (const concept of dictionary.concepts) {
    if (!concept.active) continue;
    const bucket = byCategory.get(concept.category) ?? { score: 0, matches: [], evidence: [], negatives: [], specificity: 0 };
    const seen = new Set<string>();
    const matches: ConceptMatch[] = [];

    for (const entry of termEntries(concept)) {
      const key = `${entry.kind}:${entry.term}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const index = firstIndexOf(normalized.tokens, entry.term);
      if (index < 0) continue;
      // En un reporte TI, negar una capacidad («no levanta», «no imprime»)
      // es precisamente la evidencia del problema, no un descarte.
      const negated = negatedBefore(normalized.tokens, index, entry.term);
      const weight = Number((concept.weight * multiplierFor(entry.kind, entry.term) * (negated ? 0.85 : 1)).toFixed(2));
      matches.push({
        conceptKey: concept.key,
        conceptName: concept.name,
        category: concept.category,
        matchedTerm: entry.term,
        kind: entry.kind,
        weight,
        priority: concept.priority,
        position: index,
        negated,
        evidence: `Concepto «${concept.name}» por ${entry.kind} «${entry.term}» (peso ${weight}, prioridad ${concept.priority})${negated ? "; negación de capacidad contabilizada como problema" : ""}`,
      });
    }

    matches.push(...windowMatches(concept, normalized.tokens, `Concepto «${concept.name}»`));
    if (!matches.length) {
      byCategory.set(concept.category, bucket);
      continue;
    }

    // Una negación explícita de otra categoría reduce su puntuación, nunca la elimina.
    for (const negative of concept.negatives) {
      if (containsPhrase(normalized.tokens, negative)) {
        bucket.negatives.push(`Exclusión «${negative}» del concepto «${concept.name}».`);
        bucket.score = Math.max(0, bucket.score - Math.min(2, concept.weight * 0.25));
      }
    }
    for (const match of matches) bucket.score += match.weight;
    bucket.matches.push(...matches);
    bucket.evidence.push(...matches.map((match) => match.evidence));
    bucket.specificity += matches.filter((match) => !CONTEXT_ONLY.has(match.matchedTerm)).length;
    byCategory.set(concept.category, bucket);
  }

  const categories = [...byCategory.entries()]
    .map(([category, bucket]) => ({ category, ...bucket, score: Number((bucket.score + (bucket.matches.length ? bonus.score : 0)).toFixed(2)) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || b.specificity - a.specificity
      || (b.matches[0]?.priority ?? 0) - (a.matches[0]?.priority ?? 0) || a.category.localeCompare(b.category));

  if (!categories.length) return null;
  const evidence = [...new Set(categories[0].evidence.concat(bonus.evidence))];
  const [best, second] = categories;
  const gap = second ? Number((best.score - second.score).toFixed(2)) : best.score;
  const close = Boolean(second && gap <= 1);
  const confidence = gap >= 2 && best.score >= 5 ? "alta" : gap >= 1 && best.score >= 3 ? "media" : "baja";
  const conceptKeys = [...new Set(best.matches.map((match) => match.conceptKey))];
  const generic = best.category === OTHER_CATEGORY;
  const explanation = close
    ? `Puntuaciones cercanas: ${categories.slice(0, 3).map((entry) => `${entry.category} (${entry.score})`).join("; ")}. Requiere revisión humana.`
    : `${best.category} con puntuación ${best.score}. ${evidence.slice(0, 3).join(". ")}.${second ? ` Alternativa: ${second.category} (${second.score}).` : ""}`;

  return {
    categoryLabel: best.category,
    alternatives: categories.map((entry) => ({
      category: entry.category,
      score: entry.score,
      justification: entry.evidence.slice(0, 2).join(". "),
      concepts: [...new Set(entry.matches.map((match) => match.conceptKey))],
    })),
    matchedCategories: categories.map((entry) => entry.category),
    confidence,
    score: best.score,
    explanation,
    ambiguous: close || categories.slice(1, 3).some((entry) => entry.score > 0 && Math.abs(entry.score - best.score) <= 1),
    ruleApplied: conceptKeys.length ? conceptKeys.join(" + ") : "sin concepto",
    concepts: best.matches,
    generic,
  };
}
