export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      billing_webhook_events: {
        Row: {
          error_message: string | null
          event_type: string
          id: string
          processed_at: string | null
          provider: string
          provider_event_id: string
          received_at: string
          resource_id: string | null
          status: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          provider: string
          provider_event_id: string
          received_at?: string
          resource_id?: string | null
          status?: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          received_at?: string
          resource_id?: string | null
          status?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      content_projects: {
        Row: {
          ai_prompt: string | null
          caption: string | null
          created_at: string
          duration_seconds: number | null
          hashtags: string | null
          id: string
          product_id: string | null
          script: string | null
          status: string
          target_audience: string | null
          title: string
          tone: string | null
          updated_at: string
          user_id: string
          video_type: string | null
        }
        Insert: {
          ai_prompt?: string | null
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          hashtags?: string | null
          id?: string
          product_id?: string | null
          script?: string | null
          status?: string
          target_audience?: string | null
          title: string
          tone?: string | null
          updated_at?: string
          user_id: string
          video_type?: string | null
        }
        Update: {
          ai_prompt?: string | null
          caption?: string | null
          created_at?: string
          duration_seconds?: number | null
          hashtags?: string | null
          id?: string
          product_id?: string | null
          script?: string | null
          status?: string
          target_audience?: string | null
          title?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
          video_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_projects_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_runs: {
        Row: {
          accepted_count: number
          channel: string
          collected_at: string | null
          created_by: string | null
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          inserted_count: number
          snapshot_count: number
          source: string
          started_at: string
          status: string
          updated_count: number
        }
        Insert: {
          accepted_count?: number
          channel: string
          collected_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          snapshot_count?: number
          source: string
          started_at?: string
          status?: string
          updated_count?: number
        }
        Update: {
          accepted_count?: number
          channel?: string
          collected_at?: string | null
          created_by?: string | null
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          inserted_count?: number
          snapshot_count?: number
          source?: string
          started_at?: string
          status?: string
          updated_count?: number
        }
        Relationships: []
      }
      product_metrics_history: {
        Row: {
          commission_amount: number | null
          creators_count: number | null
          id: string
          price: number | null
          product_id: string
          recorded_at: string
          sales_count: number | null
          source: string | null
        }
        Insert: {
          commission_amount?: number | null
          creators_count?: number | null
          id?: string
          price?: number | null
          product_id: string
          recorded_at?: string
          sales_count?: number | null
          source?: string | null
        }
        Update: {
          commission_amount?: number | null
          creators_count?: number | null
          id?: string
          price?: number | null
          product_id?: string
          recorded_at?: string
          sales_count?: number | null
          source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_metrics_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category_id: string | null
          commission_amount: number | null
          commission_percent: number | null
          created_at: string
          created_by: string | null
          creators_count: number | null
          data_updated_at: string
          description: string | null
          id: string
          identified_at: string
          image_url: string | null
          is_demo: boolean
          name: string
          original_url: string | null
          price: number | null
          sales_count: number | null
          source: string
          store_name: string | null
        }
        Insert: {
          category_id?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          creators_count?: number | null
          data_updated_at?: string
          description?: string | null
          id?: string
          identified_at?: string
          image_url?: string | null
          is_demo?: boolean
          name: string
          original_url?: string | null
          price?: number | null
          sales_count?: number | null
          source?: string
          store_name?: string | null
        }
        Update: {
          category_id?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          created_at?: string
          created_by?: string | null
          creators_count?: number | null
          data_updated_at?: string
          description?: string | null
          id?: string
          identified_at?: string
          image_url?: string | null
          is_demo?: boolean
          name?: string
          original_url?: string | null
          price?: number | null
          sales_count?: number | null
          source?: string
          store_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tiktok_shop_connections: {
        Row: {
          access_token_expires_at: string | null
          connected_at: string
          granted_scopes: string[]
          open_id: string
          refresh_token_expires_at: string | null
          token_ciphertext: string
          updated_at: string
          user_id: string
          user_type: number
        }
        Insert: {
          access_token_expires_at?: string | null
          connected_at?: string
          granted_scopes?: string[]
          open_id: string
          refresh_token_expires_at?: string | null
          token_ciphertext: string
          updated_at?: string
          user_id: string
          user_type?: number
        }
        Update: {
          access_token_expires_at?: string | null
          connected_at?: string
          granted_scopes?: string[]
          open_id?: string
          refresh_token_expires_at?: string | null
          token_ciphertext?: string
          updated_at?: string
          user_id?: string
          user_type?: number
        }
        Relationships: []
      }
      tiktok_shop_oauth_states: {
        Row: {
          consumed_at: string | null
          created_at: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Insert: {
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          state_hash: string
          user_id: string
        }
        Update: {
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          state_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          categories: string[]
          commission_max: number | null
          commission_min: number | null
          created_at: string
          experience_level: string | null
          goal: string | null
          onboarding_completed: boolean
          updated_at: string
          user_id: string
          video_style: string | null
        }
        Insert: {
          categories?: string[]
          commission_max?: number | null
          commission_min?: number | null
          created_at?: string
          experience_level?: string | null
          goal?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id: string
          video_style?: string | null
        }
        Update: {
          categories?: string[]
          commission_max?: number | null
          commission_min?: number | null
          created_at?: string
          experience_level?: string | null
          goal?: string | null
          onboarding_completed?: boolean
          updated_at?: string
          user_id?: string
          video_style?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          ai_generations_used: number
          billing_external_id: string | null
          billing_next_payment_at: string | null
          billing_payer_id: string | null
          billing_provider: string | null
          billing_status: string | null
          billing_updated_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          plan: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_generations_used?: number
          billing_external_id?: string | null
          billing_next_payment_at?: string | null
          billing_payer_id?: string | null
          billing_provider?: string | null
          billing_status?: string | null
          billing_updated_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_generations_used?: number
          billing_external_id?: string | null
          billing_next_payment_at?: string | null
          billing_payer_id?: string | null
          billing_provider?: string | null
          billing_status?: string | null
          billing_updated_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          plan?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_multi_gateway_billing_schema: {
        Args: Record<PropertyKey, never>
        Returns: {
          subscription_constraint_ready: boolean
          webhook_constraint_ready: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      refund_ai_generation: { Args: { _user_id: string }; Returns: number }
      reserve_ai_generation: {
        Args: { _limit: number; _user_id: string }
        Returns: {
          allowed: boolean
          period_end: string
          period_start: string
          plan: string
          status: string
          used: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
