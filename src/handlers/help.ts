import { Composer } from "grammy";
import type { Ctx } from "../bot.js";
import { inlineButton, inlineKeyboard, isOwner } from "../toolkit/index.js";
import { RU } from "../i18n.js";

// /help — plain-language explanation for non-technical users. This bot is
// button-driven: tell the user to tap /start to open the menu rather than listing
// slash commands. The same text is shown when the user taps the Help button on the
// main menu (`menu:help`). Enhance the copy for your specific bot; keep it short.
const composer = new Composer<Ctx>();

const backToMenu = inlineKeyboard([[inlineButton(RU.menu.back, "menu:main")]]);
const helpFor = (ctx: Ctx) => isOwner(ctx) ? RU.adminHelp : RU.help;

composer.command("help", async (ctx) => {
  await ctx.reply(helpFor(ctx));
});

composer.callbackQuery("menu:help", async (ctx) => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(helpFor(ctx), { reply_markup: backToMenu });
});

export default composer;
