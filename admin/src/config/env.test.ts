import { describe, expect, it } from "vitest";
import { readRuntimeConfig } from "./env";

describe("readRuntimeConfig", () => {
  it("allows demo data in non-production environments", () => {
    expect(
      readRuntimeConfig({
        VITE_APP_ENV: "demo",
        VITE_DATA_SOURCE: "demo",
      }),
    ).toEqual({
      environment: "demo",
      dataSource: "demo",
      apiBaseUrl: null,
    });
  });

  it("rejects demo data in production", () => {
    expect(() =>
      readRuntimeConfig({
        VITE_APP_ENV: "production",
        VITE_DATA_SOURCE: "demo",
      }),
    ).toThrow("Production cannot use demo data or a demo fallback.");
  });

  it("requires an API base URL for remote data", () => {
    expect(() =>
      readRuntimeConfig({
        VITE_APP_ENV: "staging",
        VITE_DATA_SOURCE: "remote",
      }),
    ).toThrow("Remote data source requires VITE_API_BASE_URL.");
  });
});
