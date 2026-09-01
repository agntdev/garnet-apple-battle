import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner, mainMenuItems } from "../toolkit/index.js";
import { RU } from "../i18n.js";

// The /start handler renders the bot's MAIN MENU — the primary way users operate
// a button-first bot. A feature adds its own button by calling
// `registerMainMenuItem(...)` in its own `src/handlers/<slug>.ts`; this handler
// renders whatever is registered (plus a Help button), so you do NOT edit this
// file to add a feature. Send ONE message — no placeholder line above the menu.
const composer = new Composer<Ctx>();

function menuFor(ctx: Ctx) {
  const owner = isOwner(ctx);
  const items = mainMenuItems().filter((item) => owner || (item.data !== "quiz:manage" && item.data !== "quiz:results"));
  return inlineKeyboard([...items.map((item) => [inlineButton(item.label, item.data)]), [inlineButton(RU.menu.help, "menu:help")]]);
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
