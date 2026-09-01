import { afterEach, describe, expect, it } from "vitest";
import { buildBot } from "../src/bot.js";
import type { QuizQuestion, QuizState } from "../src/quiz-data.js";
import { MemorySessionStorage } from "../src/toolkit/session/memory.js";
import { runSpec } from "../src/toolkit/harness/runner.js";

const previousAdmin = process.env.ADMIN_CHAT_ID;

afterEach(() => {
  if (previousAdmin === undefined) delete process.env.ADMIN_CHAT_ID;
  else process.env.ADMIN_CHAT_ID = previousAdmin;
});

const questions: QuizQuestion[] = Array.from({ length: 10 }, (_, index) => ({
  prompt: `Вопрос ${index + 1}`,
  options: ["A", "B", "C", "D"],
  correct: 0,
}));

describe("quiz administration", () => {
  it("starts a fresh session without changing the saved question bank", async () => {
    process.env.ADMIN_CHAT_ID = "100";
    const storage = new MemorySessionStorage<unknown>();
    const state: QuizState = {
      template: questions,
      session: {
        session_id: "old", token: "old-token", questions, start_time: 1, active: false,
        participantIds: ["42"],
        participants: {
          "42": { telegram_id: "42", display_name: "Анна", score: 3, total_response_time: 4_000, answers: [], questionIndex: 10, questionStartedAt: 1 },
        },
      },
    };
    await storage.write("garnet-apple-battle:quiz-state", state);
    const result = await runSpec(await buildBot("test-token", { storage: storage as never }), {
      name: "admin starts a fresh quiz", strict: false,
      steps: [{ send: { callback: "quiz:start", userId: 100 }, expect: [] }],
    });
    const saved = await storage.read("garnet-apple-battle:quiz-state") as QuizState;
    expect(result.ok).toBe(true);
    expect(saved.template).toEqual(questions);
    expect(saved.session?.active).toBe(true);
    expect(saved.session?.participantIds).toEqual([]);
    expect(saved.session?.participants).toEqual({});
  });

  it("orders results by correct answers then faster total response time", async () => {
    process.env.ADMIN_CHAT_ID = "100";
    const storage = new MemorySessionStorage<unknown>();
    const state: QuizState = {
      template: questions,
      session: {
        session_id: "session", token: "token", questions, start_time: 1, active: false,
        participantIds: ["slow", "high", "fast"],
        participants: {
          slow: { telegram_id: "slow", display_name: "Медленный", score: 5, total_response_time: 61_000, answers: [], questionIndex: 10, questionStartedAt: 1 },
          high: { telegram_id: "high", display_name: "Лидер", score: 6, total_response_time: 90_000, answers: [], questionIndex: 10, questionStartedAt: 1 },
          fast: { telegram_id: "fast", display_name: "Быстрый", score: 5, total_response_time: 9_000, answers: [], questionIndex: 10, questionStartedAt: 1 },
        },
      },
    };
    await storage.write("garnet-apple-battle:quiz-state", state);
    const result = await runSpec(await buildBot("test-token", { storage: storage as never }), {
      name: "ranked results", strict: false,
      steps: [{ send: { text: "/results", userId: 100 }, expect: [] }],
    });
    const text = result.steps[0].captured.find((call) => call.method === "sendMessage")?.payload.text;
    expect(text).toBe("Результаты викторины\n\n1. Лидер — 6 правильных — 01:30\n2. Быстрый — 5 правильных — 00:09\n3. Медленный — 5 правильных — 01:01");
  });

  it("saves each entered question and never treats /start or /cancel as question text", async () => {
    process.env.ADMIN_CHAT_ID = "100";
    const storage = new MemorySessionStorage<unknown>();
    const result = await runSpec(await buildBot("test-token", { storage: storage as never }), {
      name: "question entry controls", strict: false,
      steps: [
        { send: { callback: "quiz:setup", userId: 100 }, expect: [] },
        { send: { text: "Столица? | Москва | Рим | Минск | Париж | 1", userId: 100 }, expect: [] },
        { send: { callback: "quiz:setup:next", userId: 100 }, expect: [] },
        { send: { text: "/start", userId: 100 }, expect: [] },
        { send: { text: "/cancel", userId: 100 }, expect: [] },
        { send: { callback: "quiz:setup", userId: 100 }, expect: [] },
        { send: { text: "Цвет? | Красный | Синий | Белый | Чёрный | 1", userId: 100 }, expect: [] },
        { send: { callback: "quiz:setup:finish", userId: 100 }, expect: [] },
      ],
    });
    const saved = await storage.read("garnet-apple-battle:quiz-state") as QuizState;
    expect(result.ok).toBe(true);
    expect(saved.template).toHaveLength(2);
    expect(saved.template[0].prompt).toBe("Столица?");
    const savedMessage = result.steps[1].captured.find((call) => call.method === "sendMessage");
    expect(savedMessage?.payload.reply_markup).toEqual({
      inline_keyboard: [
        [{ text: "➕ Добавить ещё вопрос", callback_data: "quiz:setup:next" }],
        [{ text: "✅ Завершить добавление", callback_data: "quiz:setup:finish" }],
      ],
    });
    const finishMessage = result.steps[7].captured.find((call) => call.method === "editMessageText");
    expect(finishMessage?.payload.text).toBe("Добавление вопросов завершено. Сохранённые вопросы готовы в управлении викториной.");
  });
});
