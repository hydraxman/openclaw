import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildPairingReply } from "./pairing-messages.js";

describe("buildPairingReply", () => {
  let previousProfile: string | undefined;

  beforeEach(() => {
    previousProfile = process.env.OPENCLAW_PROFILE;
    process.env.OPENCLAW_PROFILE = "isolated";
  });

  afterEach(() => {
    if (previousProfile === undefined) {
      delete process.env.OPENCLAW_PROFILE;
      return;
    }
    process.env.OPENCLAW_PROFILE = previousProfile;
  });

  const cases = [
    {
      channel: "discord",
      idLine: "Your Discord user id: 1",
      code: "ABC123",
    },
    {
      channel: "slack",
      idLine: "Your Slack user id: U1",
      code: "DEF456",
    },
    {
      channel: "signal",
      idLine: "Your Signal number: +15550001111",
      code: "GHI789",
    },
    {
      channel: "telegram",
      idLine: "Your Telegram chat id: 123456",
      code: "JKL012",
    },
  ] as const;

  for (const testCase of cases) {
    it(`formats pairing reply for ${testCase.channel}`, () => {
      const text = buildPairingReply(testCase);
      expect(text).toContain(testCase.idLine);
      expect(text).toContain(`Pairing code: ${testCase.code}`);
      // CLI commands should respect OPENCLAW_PROFILE when set (most tests run with isolated profile)
      const commandRe = new RegExp(
        `(?:openclaw|openclaw) --profile isolated pairing approve ${testCase.channel} <code>`,
      );
      expect(text).toMatch(commandRe);
    });
  }
});
