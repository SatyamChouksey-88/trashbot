import { getAgentMode, isMotionTool, isReadOnlyTool, isSafetyTool } from "./agentMode.js";

export function guardTool(name: string): { blocked?: string; dryRun?: string } {
  const mode = getAgentMode();
  if (name === "stop" || name === "estop") return {};
  if (mode === "read_only" && !isReadOnlyTool(name) && !isSafetyTool(name)) {
    return { blocked: `TRASHBOT_MODE=read_only: tool "${name}" is not allowed.` };
  }
  if (mode === "dry_run" && isMotionTool(name)) {
    return { dryRun: `DRY RUN — would call ${name} on the robot (set TRASHBOT_MODE=full to execute).` };
  }
  return {};
}
