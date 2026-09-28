import { z } from "zod";

const optionalDirection = z.string().trim().max(500).nullable().optional();

export const aiContentRequestSchema = z.object({
  productId: z.string().uuid(),
  targetAudience: optionalDirection,
  videoType: optionalDirection,
  durationSeconds: z.number().int().min(1).max(180).nullable().optional(),
  tone: optionalDirection,
});

export const generatedContentSchema = z.object({
  title: z.string().trim().min(1).max(180),
  target_audience: z.string().trim().min(1).max(500),
  video_type: z.string().trim().min(1).max(200),
  duration_seconds: z.number().int().min(1).max(180),
  tone: z.string().trim().min(1).max(200),
  hook: z.string().trim().min(1).max(500),
  script: z.string().trim().min(1).max(8000),
  caption: z.string().trim().min(1).max(2500),
  hashtags: z.string().trim().min(1).max(1200),
  ai_prompt: z.string().trim().min(1).max(5000),
  strategy_notes: z.string().trim().min(1).max(2500),
});

export const aiContentResponseSchema = z.object({
  content: generatedContentSchema,
  meta: z.object({
    provider: z.literal("openai"),
    model: z.string().min(1),
    context: z.object({
      preferenceUsed: z.boolean(),
      previousProjectsUsed: z.number().int().min(0),
      competitorsUsed: z.number().int().min(0),
      metricPointsUsed: z.number().int().min(0),
    }),
  }),
});

export type AiContentRequest = z.infer<typeof aiContentRequestSchema>;
export type GeneratedContent = z.infer<typeof generatedContentSchema>;
export type AiContentResponse = z.infer<typeof aiContentResponseSchema>;
