import { z } from "zod";

const optionalUrl = z.string().trim().url().max(2000).nullable().optional();
const optionalText = z.string().trim().max(5000).nullable().optional();
const optionalMoney = z.number().finite().min(0).nullable().optional();
const optionalCounter = z.number().int().min(0).nullable().optional();

export const productIngestItemSchema = z.object({
  name: z.string().trim().min(1).max(500),
  original_url: z.string().trim().url().max(2000),
  description: optionalText,
  image_url: optionalUrl,
  category_slug: z.string().trim().min(1).max(120).nullable().optional(),
  price: optionalMoney,
  commission_amount: optionalMoney,
  commission_percent: z.number().finite().min(0).max(100).nullable().optional(),
  store_name: z.string().trim().max(500).nullable().optional(),
  sales_count: optionalCounter,
  creators_count: optionalCounter,
  external_id: z.string().trim().min(1).max(200).nullable().optional(),
  region: z.string().trim().min(2).max(10).nullable().optional(),
  currency: z.string().trim().length(3).nullable().optional(),
  sales_7d: optionalCounter,
  gmv_7d: optionalMoney,
  gmv_total: optionalMoney,
  video_count: optionalCounter,
  data_provenance: z.string().trim().max(120).nullable().optional(),
});

export const productIngestRequestSchema = z.object({
  source: z.string().trim().min(2).max(120),
  collected_at: z.string().datetime({ offset: true }).optional(),
  products: z.array(productIngestItemSchema).min(1).max(100),
});

export type ProductIngestItem = z.infer<typeof productIngestItemSchema>;
export type ProductIngestRequest = z.infer<typeof productIngestRequestSchema>;
