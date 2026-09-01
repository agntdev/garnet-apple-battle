import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, registerMainMenuItem, requireOwner } from "../toolkit/index.js";
import { rankedParticipants, readQuizState, resultsCsv } from "../quiz-data.js";

registerMainMenuItem({ label: "View results", data: "quiz:results", order: 30 });
const composer = new Composer<Ctx>();
async function showResults(ctx: Ctx, edit = false) {
  if (!(await requireOwner(ctx))) return;
  const session = (await readQuizState(ctx)).session;
  if (!session) { await ctx.reply("No quiz session has started yet."); return; }
  const ranked = rankedParticipants(session);
  const displayed = ranked.slice(0, 25);
  const suffix = ranked.length > displayed.length ? `\n\nShowing the top ${displayed.length} of ${ranked.length}. Export CSV for the full ranking.` : "";
  const text = ranked.length === 0 ? "No participants have joined this quiz yet." : `Quiz results\n\n${displayed.map((p, i) => `${i + 1}. ${p.display_name} — ${p.score}/10`).join("\n")}${suffix}`;
  const markup = inlineKeyboard([[inlineButton("Export CSV", "quiz:csv")], [inlineButton("Back to menu", "menu:main")]]);
  if (edit) await ctx.editMessageText(text, { reply_markup: markup }); else await ctx.reply(text, { reply_markup: markup });
}
composer.command("results", (ctx) => showResults(ctx));
composer.callbackQuery("quiz:results", async (ctx) => { await ctx.answerCallbackQuery(); await showResults(ctx, true); });
composer.callbackQuery("quiz:csv", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx))) return; const session = (await readQuizState(ctx)).session; if (!session || session.participantIds.length === 0) { await ctx.reply("There are no results to export yet."); return; } await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(resultsCsv(session)), "quiz-results.csv")); });
export default composer;
