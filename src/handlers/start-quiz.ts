import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner, requireOwner } from "../toolkit/index.js";
import { now } from "../clock.js";
import { QUESTION_COUNT, readQuizState, secureToken, type QuizQuestion, writeQuizState } from "../quiz-data.js";
import { RU, ownerMessages } from "../i18n.js";
import { menuFor } from "./start.js";

const composer = new Composer<Ctx>();
const setupKeyboard = inlineKeyboard([[inlineButton(RU.menu.addQuestions, "quiz:setup")], [inlineButton(RU.menu.back, "menu:main")]]);
const afterSavedKeyboard = inlineKeyboard([[inlineButton(RU.menu.addAnother, "quiz:setup:next")], [inlineButton(RU.menu.finishAdding, "quiz:setup:finish")]]);
function parseQuestion(input: string): QuizQuestion | undefined { const p = input.split("|").map((v) => v.trim()); const correct = Number(p[5]) - 1; const validText = p.slice(0, 5).every((v, i) => v.length <= (i === 0 ? 500 : 48) && new TextEncoder().encode(v).length <= (i === 0 ? 1_500 : 56)); return p.length === 6 && p.every(Boolean) && validText && Number.isInteger(correct) && correct >= 0 && correct < 4 ? { prompt: p[0], options: [p[1], p[2], p[3], p[4]], correct } : undefined; }
async function promptForQuestion(ctx: Ctx, edit: boolean) {
  const state = await readQuizState(ctx);
  const number = state.template.length + 1;
  const text = RU.questionPrompt(number);
  if (edit) await ctx.editMessageText(text); else await ctx.reply(text);
}

async function showManage(ctx: Ctx, edit: boolean) {
  const state = await readQuizState(ctx);
  const live = state.session?.active;
  const text = live
    ? RU.manageLive
    : state.template.length >= QUESTION_COUNT
      ? RU.manageReady
      : RU.manageSetup(state.template.length, QUESTION_COUNT);
  const markup = live
    ? inlineKeyboard([[inlineButton(RU.menu.endSession, "quiz:end")], [inlineButton(RU.menu.back, "menu:main")]])
    : setupKeyboard;
  if (edit) await ctx.editMessageText(text, { reply_markup: markup }); else await ctx.reply(text, { reply_markup: markup });
}

async function startQuiz(ctx: Ctx) {
  if (!(await requireOwner(ctx, ownerMessages))) return; const state = await readQuizState(ctx);
  if (state.template.length < QUESTION_COUNT) { await ctx.reply(RU.addAllQuestions(QUESTION_COUNT), { reply_markup: setupKeyboard }); return; }
  // A round is always ten questions. Extra saved questions are intentionally
  // retained as the event's question bank for a later round.
  const token = secureToken(); state.admin = { telegram_id: String(ctx.from?.id ?? ctx.chat?.id ?? ""), display_name: ctx.from?.first_name ?? RU.ownerName }; state.session = { session_id: secureToken(), token, questions: state.template.slice(0, QUESTION_COUNT), start_time: now(), active: true, participantIds: [], participants: {} }; await writeQuizState(ctx, state);
  const username = ctx.me.username; const link = username ? `https://t.me/${username}?start=${token}` : RU.joinToken(token);
  await ctx.reply(username ? RU.liveLink(link) : link);
}
composer.command("start_quiz", startQuiz);
composer.callbackQuery("quiz:manage", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; await showManage(ctx, true); });
composer.callbackQuery("quiz:setup", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; ctx.session.quizSetup = { questions: [] }; await promptForQuestion(ctx, true); });
composer.callbackQuery("quiz:setup:next", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; ctx.session.quizSetup = { questions: [] }; await promptForQuestion(ctx, true); });
composer.callbackQuery("quiz:setup:finish", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; ctx.session.quizSetup = undefined; await showManage(ctx, true); });
composer.command("cancel", async (ctx) => { ctx.session.quizSetup = undefined; await ctx.reply(RU.addingCancelled, { reply_markup: menuFor(ctx) }); });
composer.on("message:text", async (ctx, next) => { if (!ctx.session.quizSetup || ctx.message.text.trim().startsWith("/")) return next(); if (!isOwner(ctx)) { await ctx.reply(RU.ownerOnly); return; } const question = parseQuestion(ctx.message.text); if (!question) { await ctx.reply(RU.questionFormatError); return; } const state = await readQuizState(ctx); state.template.push(question); await writeQuizState(ctx, state); const saved = state.template.length; ctx.session.quizSetup = { questions: [] }; await ctx.reply(RU.questionSaved(saved), { reply_markup: afterSavedKeyboard }); });
composer.callbackQuery("quiz:start", async (ctx) => { await ctx.answerCallbackQuery(); await startQuiz(ctx); });
composer.callbackQuery("quiz:end", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; const state = await readQuizState(ctx); if (!state.session?.active) { await ctx.reply(RU.noLiveQuiz); return; } state.session.active = false; state.session.end_time = now(); await writeQuizState(ctx, state); await ctx.editMessageText(RU.sessionEnded); });
export default composer;
