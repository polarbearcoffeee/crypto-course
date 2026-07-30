import { beforeEach, describe, expect, it } from "vitest";
import {
  buildLearnerCsv,
  defaultLegacyLessons,
  demoAdministrator,
  isLegacyPinDisabled,
  readDemoLearners,
  readLegacyPin,
  saveLegacyPin,
  setLegacyPinDisabled,
  verifyDemoAdministrator,
} from "./legacyAdminDemo";

describe("legacy admin demo integration", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("contains all six legacy lessons and eighteen quiz questions", () => {
    expect(defaultLegacyLessons).toHaveLength(6);
    expect(defaultLegacyLessons.reduce((total, lesson) => total + lesson.quiz.length, 0)).toBe(18);
    expect(defaultLegacyLessons.every((lesson) => lesson.quiz.every((question) => question.options.length === 4))).toBe(true);
  });

  it("accepts only the documented demo administrator credential", () => {
    expect(verifyDemoAdministrator(demoAdministrator.username, demoAdministrator.password)).toBe(true);
    expect(verifyDemoAdministrator("wrong-admin", demoAdministrator.password)).toBe(false);
    expect(verifyDemoAdministrator(demoAdministrator.username, "wrong-password")).toBe(false);
  });

  it("exports the learner demo rows as UTF-8 compatible CSV content", () => {
    const csv = buildLearnerCsv(readDemoLearners());

    expect(csv).toContain('"學員編號"');
    expect(csv).toContain('"PMC-1042"');
    expect(csv.split("\r\n")).toHaveLength(6);
  });

  it("keeps the legacy PIN migration state in browser-only storage", () => {
    expect(readLegacyPin()).toBe("1234");
    expect(isLegacyPinDisabled()).toBe(false);

    saveLegacyPin("5678");
    setLegacyPinDisabled(true);

    expect(readLegacyPin()).toBe("5678");
    expect(isLegacyPinDisabled()).toBe(true);
  });
});
