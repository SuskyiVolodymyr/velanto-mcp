import { describe, it, expect } from "vitest";
import { loadConfig, DEFAULT_API_URL } from "../src/config.js";

describe("loadConfig", () => {
  it("throws a clear error when the token is missing", () => {
    expect(() => loadConfig({})).toThrow(/VELANTO_API_TOKEN/);
  });

  it("defaults the API url and strips trailing slashes", () => {
    expect(loadConfig({ VELANTO_API_TOKEN: "t" })).toEqual({
      token: "t",
      apiUrl: DEFAULT_API_URL,
    });
    expect(
      loadConfig({ VELANTO_API_TOKEN: "t", VELANTO_API_URL: "http://x:3001/" })
        .apiUrl,
    ).toBe("http://x:3001");
  });

  it("trims surrounding whitespace on both values", () => {
    const cfg = loadConfig({
      VELANTO_API_TOKEN: "  t  ",
      VELANTO_API_URL: "  http://x:3001  ",
    });
    expect(cfg.token).toBe("t");
    expect(cfg.apiUrl).toBe("http://x:3001");
  });
});
