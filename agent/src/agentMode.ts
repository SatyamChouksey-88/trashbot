export type AgentMode = "read_only" | "dry_run" | "full";

export function getAgentMode(): AgentMode {
  const m = (process.env.TRASHBOT_MODE ?? "dry_run").toLowerCase();
  if (m === "read_only" || m === "full") return m;
  return "dry_run";
}

export function isMotionTool(name: string): boolean {
  return [
    "start_cleaning",
    "stop",
    "set_mode",
    "drive",
    "move",
    "turn",
    "scoop",
    "estop",
  ].includes(name);
}

export function isReadOnlyTool(name: string): boolean {
  return [
    "get_status",
    "take_photo",
    "get_events",
    "get_health",
    "get_mission",
    "get_lessons",
    "plan_cleaning",
  ].includes(name);
}
