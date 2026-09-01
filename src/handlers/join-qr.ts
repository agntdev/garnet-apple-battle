import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem } from "../toolkit/index.js";
import { now } from "../clock.js";
import { displayName, publicQuestion, readQuizState, type Participant, writeQuizState } from "../quiz-data.js";
import { RU } from "../i18n.js";

registerMainMenuItem({ label: RU.menu.join, data: "join:qr", order: 10 });
const composer = new Composer<Ctx>();

function questionKeyboard(index: number, options: readonly string[]) {
  return inlineKeyboard([[inlineButton(`А. ${options[0]}`, `quiz:a:${index}:0`)], [inlineButton(`Б. ${options[1]}`, `quiz:a:${index}:1`)], [inlineButton(`В. ${options[2]}`, `quiz:a:${index}:2`)], [inlineButton(`Г. ${options[3]}`, `quiz:a:${index}:3`)]]);
}
async function finish(ctx: Ctx, participant: Participant, state: Awaited<ReturnType<typeof readQuizState>>, edit: boolean) {
  participant.completedAt = now();
  await writeQuizState(ctx, state);
  const text = RU.thankYou;
  if (edit) await ctx.editMessageText(text); else await ctx.reply(text);
}
async function showQuestion(ctx: Ctx, participant: Participant, state: Awaited<ReturnType<typeof readQuizState>>, edit: boolean) {
  const session = state.session;
  if (!session || !session.active) { await ctx.reply(RU.noActiveQuiz); return; }
  const question = session.questions[participant.questionIndex];
  if (!question) { await finish(ctx, participant, state, edit); return; }
  const payload = { reply_markup: questionKeyboard(participant.questionIndex, question.options) };
  if (edit) await ctx.editMessageText(publicQuestion(question, participant.questionIndex + 1), payload);
  else await ctx.reply(publicQuestion(question, participant.questionIndex + 1), payload);
}
async function join(ctx: Ctx, token: string | undefined) {
  const state = await readQuizState(ctx); const session = state.session;
  if (!session || !session.active || !token || token !== session.token) { await ctx.reply(RU.invalidLink); return; }
  const id = String(ctx.from?.id ?? ctx.chat?.id ?? "");
  if (!id) { await ctx.reply(RU.accountUnavailable); return; }
  let participant = session.participants[id];
  if (!participant) { participant = { telegram_id: id, display_name: displayName(ctx), score: 0, total_response_time: 0, answers: [], questionIndex: 0, questionStartedAt: now() }; session.participants[id] = participant; session.participantIds.push(id); await writeQuizState(ctx, state); }
  if (participant.completedAt) { await ctx.reply(RU.alreadyCompleted); return; }
  await showQuestion(ctx, participant, state, false);
}
composer.callbackQuery("join:qr", async (ctx) => { await ctx.answerCallbackQuery(); await join(ctx, undefined); });
composer.on("message:text", async (ctx, next) => { const parts = ctx.message.text.trim().split(/\s+/, 2); if (parts[0] !== "/start" || !parts[1]) return next(); await join(ctx, parts[1]); });
composer.on("callback_query:data", async (ctx, next) => {
  const match = /^quiz:a:(\d+):([0-3])$/.exec(ctx.callbackQuery.data); if (!match) return next();
  await ctx.answerCallbackQuery(); const state = await readQuizState(ctx); const session = state.session; const participant = session?.participants[String(ctx.from?.id ?? "")];
  if (!session || !session.active || !participant || participant.completedAt) { await ctx.editMessageText(RU.attemptInactive); return; }
  const index = Number(match[1]); if (index !== participant.questionIndex) { await ctx.editMessageText(RU.answerRecorded); return; }
  const elapsedMs = now() - participant.questionStartedAt;
  if (elapsedMs > 15_000) {
    participant.answers.push({ question: index, selected: null, elapsedMs: 15_000, onTime: false });
    participant.total_response_time += 15_000;
  }
  else { const selected = Number(match[2]); participant.answers.push({ question: index, selected, elapsedMs, onTime: true }); participant.total_response_time += elapsedMs; if (session.questions[index].correct === selected) participant.score += 1; }
  participant.questionIndex += 1; participant.questionStartedAt = now(); await writeQuizState(ctx, state); await showQuestion(ctx, participant, state, true);
});
export default composer;
