export type AgentMode = "read_only" | "dry_run" | "full";

export function getAgentMode(): AgentMode {
  const m = (process.env.TRASHBOT_MODE ?? "dry_run").toLowerCase();
  if (m === "read_only" || m === "full") return m;
  return "dry_run";
}

export function isSafetyTool(name: string): boolean {
  return name === "stop" || name === "estop" || name === "run_command";
}

export function isMotionTool(name: string): boolean {
  return [
    "start_cleaning",
    "set_mode",
    "drive",
    "move",
    "turn",
    "scoop",
    "add_alias",
    "remove_alias",
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
    "list_aliases",
    "run_command",
  ].includes(name);
}
