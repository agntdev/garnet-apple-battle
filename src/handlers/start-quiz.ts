import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { now } from "../clock.js";
import { QUESTION_COUNT, readQuizState, secureToken, type QuizQuestion, writeQuizState } from "../quiz-data.js";

registerMainMenuItem({ label: "Manage quiz", data: "quiz:manage", order: 20 });
const composer = new Composer<Ctx>();
const setupKeyboard = inlineKeyboard([[inlineButton("Add questions", "quiz:setup")], [inlineButton("Back to menu", "menu:main")]]);
function parseQuestion(input: string): QuizQuestion | undefined { const p = input.split("|").map((v) => v.trim()); const correct = Number(p[5]) - 1; const validText = p.slice(0, 5).every((v, i) => v.length <= (i === 0 ? 500 : 48) && new TextEncoder().encode(v).length <= (i === 0 ? 1_500 : 56)); return p.length === 6 && p.every(Boolean) && validText && Number.isInteger(correct) && correct >= 0 && correct < 4 ? { prompt: p[0], options: [p[1], p[2], p[3], p[4]], correct } : undefined; }
async function startQuiz(ctx: Ctx) {
  if (!(await requireOwner(ctx))) return; const state = await readQuizState(ctx);
  if (state.template.length !== QUESTION_COUNT) { await ctx.reply(`Add all ${QUESTION_COUNT} questions before starting the quiz.`, { reply_markup: setupKeyboard }); return; }
  const token = secureToken(); state.admin = { telegram_id: String(ctx.from?.id ?? ctx.chat?.id ?? ""), display_name: ctx.from?.first_name ?? "Owner" }; state.session = { session_id: secureToken(), token, questions: state.template, start_time: now(), active: true, participantIds: [], participants: {} }; await writeQuizState(ctx, state);
  const username = ctx.me.username; const link = username ? `https://t.me/${username}?start=${token}` : `Use this join token in the event QR: ${token}`;
  await ctx.reply(`The quiz is live. Put this link in the event QR code:\n${link}\n\nParticipants can join now.`);
}
composer.command("start_quiz", startQuiz);
composer.callbackQuery("quiz:manage", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; const state = await readQuizState(ctx); const live = state.session?.active; const text = live ? "The quiz is live. You can end the session when the event is finished." : state.template.length === QUESTION_COUNT ? "Your 10 questions are ready. Start the quiz when the event is ready." : `Add ${QUESTION_COUNT} questions before starting. You have ${state.template.length} of ${QUESTION_COUNT}.`; const markup = live ? inlineKeyboard([[inlineButton("End session", "quiz:end")], [inlineButton("Back to menu", "menu:main")]]) : setupKeyboard; await ctx.editMessageText(text, { reply_markup: markup }); });
composer.callbackQuery("quiz:setup", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; ctx.session.quizSetup = { questions: [] }; await ctx.editMessageText("Send question 1 in this format:\nQuestion | option A | option B | option C | option D | correct number\n\nUse 1, 2, 3, or 4 for the correct answer."); });
composer.on("message:text", async (ctx, next) => { const draft = ctx.session.quizSetup; if (!draft) return next(); if (!isOwner(ctx)) { await ctx.reply("Only the owner can configure quiz questions."); return; } const question = parseQuestion(ctx.message.text); if (!question) { await ctx.reply("Use: question | option A | option B | option C | option D | correct number. Keep each option under 48 characters."); return; } draft.questions.push(question); if (draft.questions.length < QUESTION_COUNT) { await ctx.reply(`Question ${draft.questions.length} saved. Send question ${draft.questions.length + 1} in the same format.`); return; } const state = await readQuizState(ctx); state.template = draft.questions; await writeQuizState(ctx, state); ctx.session.quizSetup = undefined; await ctx.reply("All 10 questions are saved. Use Start quiz when you are ready.", { reply_markup: inlineKeyboard([[inlineButton("Start quiz", "quiz:start")]]) }); });
composer.callbackQuery("quiz:start", async (ctx) => { await ctx.answerCallbackQuery(); await startQuiz(ctx); });
composer.callbackQuery("quiz:end", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; const state = await readQuizState(ctx); if (!state.session?.active) { await ctx.reply("There isn't a live quiz to end."); return; } state.session.active = false; state.session.end_time = now(); await writeQuizState(ctx, state); await ctx.editMessageText("The quiz session has ended. Results are ready when you need them."); });
export default composer;
