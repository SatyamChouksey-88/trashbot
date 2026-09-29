import { describe, expect, it, vi, afterEach } from "vitest";
import { getAgentMode } from "../src/agentMode.js";
import { guardTool } from "../src/toolGuard.js";

describe("agent modes", () => {
  afterEach(() => {
    delete process.env.TRASHBOT_MODE;
  });

  it("defaults to dry_run", () => {
    expect(getAgentMode()).toBe("dry_run");
  });

  it("dry_run blocks motion tools", () => {
    vi.stubEnv("TRASHBOT_MODE", "dry_run");
    const g = guardTool("drive");
    expect(g.dryRun).toMatch(/DRY RUN/);
  });

  it("read_only blocks drive", () => {
    vi.stubEnv("TRASHBOT_MODE", "read_only");
    const g = guardTool("drive");
    expect(g.blocked).toMatch(/read_only/);
  });

  it("read_only allows stop", () => {
    vi.stubEnv("TRASHBOT_MODE", "read_only");
    expect(guardTool("stop")).toEqual({});
  });
});
