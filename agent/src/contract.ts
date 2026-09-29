import { z } from "zod";

export const detectionSchema = z.object({
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  score: z.number(),
});

export const statusSchema = z.object({
  fw: z.string(),
  mode: z.string(),
  state: z.union([z.string(), z.number()]),
  distance_cm: z.number().optional(),
  detections: z.array(detectionSchema).optional(),
  detections_age_ms: z.number().optional(),
  vision_ms: z.number().optional(),
  detector: z.string().optional(),
  model_loaded: z.boolean().optional(),
  camera: z.string().optional(),
  estop: z.boolean().optional(),
  session: z.record(z.unknown()).optional(),
  uptime_ms: z.number().optional(),
});

export const logSchema = z.object({
  events: z.array(
    z.object({
      seq: z.number(),
      t_ms: z.number(),
      type: z.union([z.string(), z.number()]),
      a: z.number().optional(),
      b: z.number().optional(),
    }),
  ),
  last_seq: z.number(),
});

export type RobotStatus = z.infer<typeof statusSchema>;
