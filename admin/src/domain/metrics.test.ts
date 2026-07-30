import { describe, expect, it } from "vitest";

import { getMetricDefinition, metricDictionary, metricIds } from "./metrics";

describe("metric dictionary", () => {
  it("publishes every required metric", () => {
    expect(Object.keys(metricDictionary)).toEqual(metricIds);
  });

  it("defines every required dictionary field", () => {
    for (const metric of Object.values(metricDictionary)) {
      expect(metric.source.length).toBeGreaterThan(0);
      expect(metric.numerator).toBeTruthy();
      expect(metric.denominator).toBeTruthy();
      expect(metric.window).toBeTruthy();
      expect(metric.timezone).toBe("Asia/Taipei");
      expect(metric.latePolicy).toBeTruthy();
      expect(metric.refresh).toBeTruthy();
      expect(metric.version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("keeps first-touch and latest-touch source reporting separate", () => {
    expect(getMetricDefinition("source").window).toContain("first-touch");
    expect(getMetricDefinition("source").window).toContain("latest-touch");
  });

  it("defines D7 retention as activity on the seventh-day window", () => {
    const retention = getMetricDefinition("retention");

    expect(retention.numerator).toContain("第 7 日");
    expect(retention.window).toContain("第 7 日");
  });
});
