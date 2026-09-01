import type { Ctx } from "./bot.js";
import { RU } from "./i18n.js";

export const QUESTION_SECONDS = 15;
export const QUESTION_COUNT = 10;
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
export function publicQuestion(question: QuizQuestion, number: number): string { return `${RU.question(number, QUESTION_COUNT, QUESTION_SECONDS)}\n\n${question.prompt}`; }
export function rankedParticipants(session: QuizSession): Participant[] { return session.participantIds.map((id) => session.participants[id]).filter((p): p is Participant => p !== undefined).sort((a, b) => b.score - a.score || a.total_response_time - b.total_response_time || a.display_name.localeCompare(b.display_name)); }
export function resultsCsv(session: QuizSession): string { const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`; return [RU.csvHeader, ...rankedParticipants(session).map((p, i) => [i + 1, p.display_name, p.score, (p.total_response_time / 1000).toFixed(2)].map(cell).join(","))].join("\n"); }
