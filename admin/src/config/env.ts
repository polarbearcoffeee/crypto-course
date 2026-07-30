export const appEnvironments = [
  "demo",
  "development",
  "test",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof appEnvironments)[number];
export type DataSource = "demo" | "remote";

export interface RuntimeConfig {
  environment: AppEnvironment;
  dataSource: DataSource;
  apiBaseUrl: string | null;
}

type EnvironmentInput = Partial<Record<"VITE_APP_ENV" | "VITE_DATA_SOURCE" | "VITE_API_BASE_URL", string>>;

export function readRuntimeConfig(input: EnvironmentInput): RuntimeConfig {
  const environment = input.VITE_APP_ENV;
  const dataSource = input.VITE_DATA_SOURCE;
  const apiBaseUrl = input.VITE_API_BASE_URL?.trim() || null;

  if (!appEnvironments.includes(environment as AppEnvironment)) {
    throw new Error(`Unsupported VITE_APP_ENV: ${environment ?? "(missing)"}`);
  }
  const validEnvironment = environment as AppEnvironment;

  if (dataSource !== "demo" && dataSource !== "remote") {
    throw new Error(`Unsupported VITE_DATA_SOURCE: ${dataSource ?? "(missing)"}`);
  }

  if (validEnvironment === "production" && dataSource === "demo") {
    throw new Error("Production cannot use demo data or a demo fallback.");
  }

  if (dataSource === "remote" && !apiBaseUrl) {
    throw new Error("Remote data source requires VITE_API_BASE_URL.");
  }

  return {
    environment: validEnvironment,
    dataSource,
    apiBaseUrl,
  };
}

export const runtimeConfig = readRuntimeConfig({
  VITE_APP_ENV: import.meta.env.VITE_APP_ENV,
  VITE_DATA_SOURCE: import.meta.env.VITE_DATA_SOURCE,
  VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
});
