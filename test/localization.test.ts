import { afterEach, describe, expect, it } from "vitest";
import { buildBot } from "../src/bot.js";
import { runSpec } from "../src/toolkit/harness/runner.js";
import { MemorySessionStorage } from "../src/toolkit/session/memory.js";
import type { QuizState } from "../src/quiz-data.js";

const previousAdmin = process.env.ADMIN_CHAT_ID;

afterEach(() => {
  if (previousAdmin === undefined) delete process.env.ADMIN_CHAT_ID;
  else process.env.ADMIN_CHAT_ID = previousAdmin;
});

describe("Russian interface and owner-only controls", () => {
  async function menuLabels(userId: number) {
    process.env.ADMIN_CHAT_ID = "100";
    const result = await runSpec(await buildBot("test-token"), {
      name: "menu", strict: false,
      steps: [{ send: { text: "/start", userId }, expect: [] }],
    });
    const call = result.steps[0].captured.find((entry) => entry.method === "sendMessage");
    const markup = call?.payload.reply_markup as { inline_keyboard: Array<Array<{ text: string }>> };
    return markup.inline_keyboard.flat().map((button) => button.text);
  }

  it("shows only participant controls to a regular user", async () => {
    await expect(menuLabels(99)).resolves.toEqual(["Участвовать", "Помощь"]);
  });

  it("shows Russian administration controls only to the configured owner", async () => {
    await expect(menuLabels(100)).resolves.toEqual([
      "Участвовать", "Управление викториной", "Результаты", "Помощь",
    ]);
  });

  it("denies /results to a participant in Russian", async () => {
    process.env.ADMIN_CHAT_ID = "100";
    const result = await runSpec(await buildBot("test-token"), {
      name: "participant results denied", strict: false,
      steps: [{ send: { text: "/results", userId: 99 }, expect: [] }],
    });
    const call = result.steps[0].captured.find((entry) => entry.method === "sendMessage");
    expect(call?.payload.text).toBe("Это действие доступно только администратору.");
  });

  it("sends only the required Russian thank-you message after question ten", async () => {
    const storage = new MemorySessionStorage<unknown>();
    const questions = Array.from({ length: 10 }, () => ({
      prompt: "Тестовый вопрос", options: ["A", "B", "C", "D"] as [string, string, string, string], correct: 0,
    }));
    const state: QuizState = {
      template: questions,
      session: {
        session_id: "session", token: "event-token", questions, start_time: 0, active: true,
        participantIds: [], participants: {},
      },
    };
    storage.write("garnet-apple-battle:quiz-state", state);
    const steps = [
      { send: { text: "/start event-token", userId: 99 }, expect: [] },
      ...Array.from({ length: 10 }, (_, index) => ({
        send: { callback: `quiz:a:${index}:0`, userId: 99 },
        expect: index === 9 ? [{ method: "editMessageText", payload: { text: "Спасибо за участие! Результаты GARNET APPLE BATTLE будут объявлены после презентации Apple" } }] : [],
      })),
    ];
    const result = await runSpec(await buildBot("test-token", { storage: storage as never }), {
      name: "quiz completion", strict: false, steps,
    });
    const finalCalls = result.steps[10].captured;
    expect(result.ok).toBe(true);
    expect(finalCalls.filter((call) => call.method === "editMessageText")).toHaveLength(1);
    expect(finalCalls.map((call) => call.method)).toEqual(["answerCallbackQuery", "editMessageText"]);
  });
});
