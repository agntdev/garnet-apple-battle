import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner } from "../toolkit/index.js";
import { RU } from "../i18n.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

export function menuFor(ctx: Ctx) {
  if (isOwner(ctx)) {
    return inlineKeyboard([
      [inlineButton(RU.menu.startQuiz, "quiz:start")],
      [inlineButton(RU.menu.results, "quiz:results")],
      [inlineButton(RU.menu.manage, "quiz:manage")],
      [inlineButton("❓ Помощь", "menu:help")],
    ]);
  }
  return inlineKeyboard([
    [inlineButton(RU.menu.join, "join:qr")],
    [inlineButton(RU.menu.help, "menu:help")],
  ]);
}

composer.command("start", async (ctx) => {
  await ctx.reply(RU.welcome, { reply_markup: menuFor(ctx) });
});

// "Back to menu" — re-render the main menu in place from any sub-view.
composer.callbackQuery("menu:main", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(RU.welcome, { reply_markup: menuFor(ctx) });
});

export default composer;
