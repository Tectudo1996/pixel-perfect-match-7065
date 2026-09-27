export type ProductCategory = {
  name: string;
  slug?: string | null;
};

export type Produto = {
  id: string;
  name: string;
  image_url: string | null;
  price: number | null;
  commission_amount: number | null;
  commission_percent: number | null;
  store_name: string | null;
  sales_count: number | null;
  creators_count: number | null;
  source: string;
  data_updated_at: string;
  categories?: ProductCategory | null;
};
