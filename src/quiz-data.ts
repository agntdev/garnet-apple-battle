import type { Ctx } from "./bot.js";
import { RU } from "./i18n.js";

export const QUESTION_SECONDS = 15;
const STATE_KEY = "garnet-apple-battle:quiz-state";
export interface QuizQuestion { prompt: string; options: [string, string, string, string]; correct: number; }
export interface Answer { question: number; selected: number | null; elapsedMs: number; onTime: boolean; }
export interface Participant { telegram_id: string; display_name: string; score: number; total_response_time: number; answers: Answer[]; questionIndex: number; questionStartedAt: number; completedAt?: number; }
export interface QuizSession { session_id: string; token: string; questions: QuizQuestion[]; start_time: number; end_time?: number; active: boolean; participantIds: string[]; participants: Record<string, Participant>; }
export interface QuizState { template: QuizQuestion[]; session?: QuizSession; admin?: { telegram_id: string; display_name: string }; }
export async function readQuizState(ctx: Ctx): Promise<QuizState> { return ((await ctx.persistentStore.read(STATE_KEY)) as QuizState | undefined) ?? { template: [] }; }
export async function writeQuizState(ctx: Ctx, state: QuizState): Promise<void> { await ctx.persistentStore.write(STATE_KEY, state); }
export function displayName(ctx: Ctx): string { const from = ctx.from; return from ? ([from.first_name, from.last_name].filter(Boolean).join(" ") || RU.participantName) : RU.participantName; }
export function secureToken(): string { return crypto.randomUUID().replace(/-/g, "").slice(0, 20); }
export function publicQuestion(question: QuizQuestion, number: number, total: number): string { return `${RU.question(number, total, QUESTION_SECONDS)}\n\n${question.prompt}`; }
export function formatResponseTime(totalMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function rankedParticipants(session: QuizSession): Participant[] {
  // Array#sort is stable in the supported JavaScript runtimes. Returning zero
  // for a complete tie deliberately preserves participant join order.
  return session.participantIds
    .map((id) => session.participants[id])
    .filter((p): p is Participant => p !== undefined)
    .sort((a, b) => b.score - a.score || a.total_response_time - b.total_response_time);
}

export function resultsCsv(session: QuizSession): string {
  const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [
    RU.csvHeader,
    ...rankedParticipants(session).map((p, i) => [
      i + 1,
      p.display_name,
      p.score,
      formatResponseTime(p.total_response_time),
    ].map(cell).join(",")),
  ].join("\n");
}
