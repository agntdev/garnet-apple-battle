import { afterEach, describe, expect, it } from "vitest";
import { buildBot } from "../src/bot.js";
import { MemorySessionStorage, parseBotSpec, runSpec } from "../src/toolkit/index.js";
import { publicQuestion, type QuizQuestion, type QuizState } from "../src/quiz-data.js";

const STATE_KEY = "garnet-apple-battle:quiz-state";
const originalAdminId = process.env.ADMIN_CHAT_ID;

afterEach(() => {
  if (originalAdminId === undefined) delete process.env.ADMIN_CHAT_ID;
  else process.env.ADMIN_CHAT_ID = originalAdminId;
});

describe("dynamic quiz question bank", () => {
  it("appends after ten questions, reports the stored count, and starts with every saved question", async () => {
    process.env.ADMIN_CHAT_ID = "1";
    const storage = new MemorySessionStorage<unknown>();
    const existing = Array.from({ length: 10 }, (_, index): QuizQuestion => ({
      prompt: `Сохранённый вопрос ${index + 1}`,
      options: ["A", "B", "C", "D"],
      correct: 0,
    }));
    await storage.write(STATE_KEY, {
      template: existing.map((question) => ({
        ...question,
        options: [...question.options] as QuizQuestion["options"],
      })),
    } satisfies QuizState);
    const bot = await buildBot("123456:TEST", { storage: storage as never });

    const added = [11, 12, 13].map(
      (number) => `Новый вопрос ${number} | A | B | C | D | 1`,
    );
    const result = await runSpec(bot, parseBotSpec({
      name: "admin appends questions beyond the original quiz size",
      steps: [
        { send: { callback: "quiz:setup", userId: 1, chatId: 1 }, expect: [{ method: "editMessageText", payload: { text: "Отправьте вопрос 11 в формате: Вопрос | вариант A | вариант B | вариант C | вариант D | номер правильного ответа" } }] },
        { send: { text: added[0], userId: 1, chatId: 1 }, expect: [{ method: "sendMessage", payload: { text: "Вопрос 11 сохранён. Добавьте следующий вопрос или завершите добавление." } }] },
        { send: { callback: "quiz:setup:next", userId: 1, chatId: 1 }, expect: [{ method: "editMessageText", payload: { text: "Отправьте вопрос 12 в формате: Вопрос | вариант A | вариант B | вариант C | вариант D | номер правильного ответа" } }] },
        { send: { text: added[1], userId: 1, chatId: 1 }, expect: [{ method: "sendMessage", payload: { text: "Вопрос 12 сохранён. Добавьте следующий вопрос или завершите добавление." } }] },
        { send: { callback: "quiz:setup:next", userId: 1, chatId: 1 }, expect: [{ method: "editMessageText", payload: { text: "Отправьте вопрос 13 в формате: Вопрос | вариант A | вариант B | вариант C | вариант D | номер правильного ответа" } }] },
        { send: { text: added[2], userId: 1, chatId: 1 }, expect: [{ method: "sendMessage", payload: { text: "Вопрос 13 сохранён. Добавьте следующий вопрос или завершите добавление." } }] },
        { send: { callback: "quiz:setup:finish", userId: 1, chatId: 1 }, expect: [{ method: "editMessageText", payload: { text: "Все 13 вопросов готовы. Начните викторину, когда будете готовы." } }] },
        { send: { callback: "quiz:start", userId: 1, chatId: 1 }, expect: [{ method: "sendMessage" }] },
      ],
    }));

    expect(result.ok, result.steps.flatMap((step) => step.failures).join("\n")).toBe(true);
    const state = await storage.read(STATE_KEY) as QuizState;
    expect(state.template).toHaveLength(13);
    expect(state.template.slice(0, 10)).toEqual(existing);
    expect(state.template.slice(10).map((question) => question.prompt)).toEqual(added.map((line) => line.split(" | ")[0]));
    expect(state.session?.questions).toEqual(state.template);
    expect(publicQuestion(state.session!.questions[12], 13, state.session!.questions.length)).toContain("Вопрос 13 из 13");
  });
});
