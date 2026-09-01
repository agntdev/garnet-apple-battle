import { Composer, InputFile } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, requireOwner } from "../toolkit/index.js";
import { formatResponseTime, rankedParticipants, readQuizState, resultsCsv } from "../quiz-data.js";
import { RU, ownerMessages } from "../i18n.js";

const composer = new Composer<Ctx>();

const MAX_RESULT_MESSAGE_LENGTH = 4_096;

function resultPages(session: Awaited<ReturnType<typeof readQuizState>>["session"]) {
  if (!session) return [];
  const rows = rankedParticipants(session).map((participant, index) =>
    RU.resultRow(
      index + 1,
      participant.display_name,
      participant.score,
      formatResponseTime(participant.total_response_time),
    ),
  );
  const pages: string[][] = [[]];
  for (const row of rows) {
    const current = pages[pages.length - 1];
    // Leave room for the page title and its separating newlines.
    if (current.length > 0 && current.join("\n").length + row.length + 96 > MAX_RESULT_MESSAGE_LENGTH) {
      pages.push([]);
    }
    pages[pages.length - 1].push(row);
  }
  return pages;
}

function resultsKeyboard(page: number, totalPages: number) {
  const navigation = [];
  if (page > 0) navigation.push(inlineButton(RU.menu.previous, `quiz:results:${page - 1}`));
  if (page < totalPages - 1) navigation.push(inlineButton(RU.menu.next, `quiz:results:${page + 1}`));
  return inlineKeyboard([
    ...(navigation.length > 0 ? [navigation] : []),
    [inlineButton(RU.menu.exportCsv, "quiz:csv")],
    [inlineButton(RU.menu.back, "menu:main")],
  ]);
}

async function showResults(ctx: Ctx, edit = false, requestedPage = 0) {
  if (!(await requireOwner(ctx, ownerMessages))) return;
  const session = (await readQuizState(ctx)).session;
  if (!session) { await ctx.reply(RU.noSession); return; }
  const pages = resultPages(session);
  const page = Math.max(0, Math.min(requestedPage, pages.length - 1));
  const text = pages.length === 0
    ? RU.noParticipants
    : `${pages.length === 1 ? RU.resultsTitle : RU.resultsPage(page + 1, pages.length)}\n\n${pages[page].join("\n")}`;
  const markup = resultsKeyboard(page, Math.max(1, pages.length));
  if (edit) await ctx.editMessageText(text, { reply_markup: markup }); else await ctx.reply(text, { reply_markup: markup });
}
composer.command("results", (ctx) => showResults(ctx));
composer.callbackQuery("quiz:results", async (ctx) => { await ctx.answerCallbackQuery(); await showResults(ctx, true); });
composer.callbackQuery(/^quiz:results:(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const page = Number(ctx.callbackQuery.data.split(":")[2]);
  await showResults(ctx, true, page);
});
composer.callbackQuery("quiz:csv", async (ctx) => { await ctx.answerCallbackQuery(); if (!(await requireOwner(ctx, ownerMessages))) return; const session = (await readQuizState(ctx)).session; if (!session || session.participantIds.length === 0) { await ctx.reply(RU.noExport); return; } await ctx.replyWithDocument(new InputFile(new TextEncoder().encode(resultsCsv(session)), "quiz-results.csv")); });
export default composer;
