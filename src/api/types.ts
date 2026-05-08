export type Provider = {
  id: number;
  slug: string;
  name: string;
  website_url: string | null;
  docs_url: string | null;
  pricing_url: string | null;
  active: boolean;
  notes: string | null;
  icon_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Model = {
  id: number;
  canonical_slug: string;
  vendor: string;
  family: string | null;
  model_name: string;
  display_name: string | null;
  status: string | null;
  open_weights: boolean;
  context_window: number | null;
  release_date: string | null;
};

export type PriceRow = {
  offer_id: number;
  provider_slug: string;
  provider_name: string;
  canonical_slug: string;
  display_name: string | null;
  family: string | null;
  metric: string;
  unit: string;
  currency: string;
  batch_flag: 0 | 1;
  tier_key: string | null;
  price_numeric: number;
  latest_observed_at: string | null;
};

export type Change = {
  observed_at: string;
  provider_slug: string;
  canonical_slug: string;
  metric: string;
  old_price: number | null;
  new_price: number | null;
};

export type ListResponse<T> = { data: T[]; limit: number; offset: number };
