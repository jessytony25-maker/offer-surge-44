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
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      affiliate_accounts: {
        Row: {
          affiliate_id: string | null
          api_key_set: boolean
          api_secret_set: boolean
          created_at: string
          extra_params: Json
          id: string
          marketplace: string
          sub_id: string | null
          tracking_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_id?: string | null
          api_key_set?: boolean
          api_secret_set?: boolean
          created_at?: string
          extra_params?: Json
          id?: string
          marketplace: string
          sub_id?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          affiliate_id?: string | null
          api_key_set?: boolean
          api_secret_set?: boolean
          created_at?: string
          extra_params?: Json
          id?: string
          marketplace?: string
          sub_id?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_accounts_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          affiliate_program: string
          affiliate_url: string
          clicks: number
          created_at: string
          id: string
          last_used_at: string | null
          marketplace: string
          method: string
          offer_id: string | null
          original_url: string
          product_id: string | null
          sub_id: string | null
          tracking_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_program: string
          affiliate_url: string
          clicks?: number
          created_at?: string
          id?: string
          last_used_at?: string | null
          marketplace: string
          method?: string
          offer_id?: string | null
          original_url: string
          product_id?: string | null
          sub_id?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          affiliate_program?: string
          affiliate_url?: string
          clicks?: number
          created_at?: string
          id?: string
          last_used_at?: string | null
          marketplace?: string
          method?: string
          offer_id?: string | null
          original_url?: string
          product_id?: string | null
          sub_id?: string | null
          tracking_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          channel: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          level: string
          meta: Json
          user_id: string
        }
        Insert: {
          action: string
          channel?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          level?: string
          meta?: Json
          user_id?: string
        }
        Update: {
          action?: string
          channel?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          level?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      automation_rules: {
        Row: {
          automation_id: string
          created_at: string
          field: string
          id: string
          operator: string
          user_id: string
          value: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          field: string
          id?: string
          operator?: string
          user_id?: string
          value: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          field?: string
          id?: string
          operator?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_rules_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          errors: number
          finished_at: string | null
          id: string
          last_error: string | null
          offers_evaluated: number
          offers_published: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          errors?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          offers_evaluated?: number
          offers_published?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          errors?: number
          finished_at?: string | null
          id?: string
          last_error?: string | null
          offers_evaluated?: number
          offers_published?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          active: boolean
          config: Json
          created_at: string
          daily_limit: number
          end_time: string
          group_id: string | null
          id: string
          interval_minutes: number
          last_run_at: string | null
          name: string
          start_time: string
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          config?: Json
          created_at?: string
          daily_limit?: number
          end_time?: string
          group_id?: string | null
          id?: string
          interval_minutes?: number
          last_run_at?: string | null
          name: string
          start_time?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          config?: Json
          created_at?: string
          daily_limit?: number
          end_time?: string
          group_id?: string | null
          id?: string
          interval_minutes?: number
          last_run_at?: string | null
          name?: string
          start_time?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          user_id?: string | null
        }
        Relationships: []
      }
      channel_connections: {
        Row: {
          created_at: string
          id: string
          last_error: string | null
          last_test_at: string | null
          meta: Json
          platform: Database["public"]["Enums"]["channel_platform"]
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_test_at?: string | null
          meta?: Json
          platform: Database["public"]["Enums"]["channel_platform"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_error?: string | null
          last_test_at?: string | null
          meta?: Json
          platform?: Database["public"]["Enums"]["channel_platform"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_health: {
        Row: {
          channel: string
          created_at: string
          failure_count: number
          group_id: string | null
          id: string
          last_error: string | null
          last_failure_at: string | null
          last_success_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          failure_count?: number
          group_id?: string | null
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          channel?: string
          created_at?: string
          failure_count?: number
          group_id?: string | null
          id?: string
          last_error?: string | null
          last_failure_at?: string | null
          last_success_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_health_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      clicks: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          marketplace: string | null
          offer_id: string | null
          publication_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clicks_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clicks_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          amount: number
          conversion_id: string | null
          created_at: string
          id: string
          marketplace: string | null
          offer_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          conversion_id?: string | null
          created_at?: string
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          amount?: number
          conversion_id?: string | null
          created_at?: string
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commissions_conversion_id_fkey"
            columns: ["conversion_id"]
            isOneToOne: false
            referencedRelation: "conversions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      conversions: {
        Row: {
          amount: number
          created_at: string
          id: string
          marketplace: string | null
          offer_id: string | null
          publication_id: string | null
          status: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          status?: string
          user_id?: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversions_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      copy_experiments: {
        Row: {
          clicks: number
          conversions: number
          copy_text: string
          created_at: string
          group_id: string | null
          id: string
          impressions: number
          is_winner: boolean | null
          offer_id: string | null
          updated_at: string
          user_id: string
          variant_name: string
        }
        Insert: {
          clicks?: number
          conversions?: number
          copy_text: string
          created_at?: string
          group_id?: string | null
          id?: string
          impressions?: number
          is_winner?: boolean | null
          offer_id?: string | null
          updated_at?: string
          user_id?: string
          variant_name: string
        }
        Update: {
          clicks?: number
          conversions?: number
          copy_text?: string
          created_at?: string
          group_id?: string | null
          id?: string
          impressions?: number
          is_winner?: boolean | null
          offer_id?: string | null
          updated_at?: string
          user_id?: string
          variant_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "copy_experiments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "copy_experiments_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          discount_text: string | null
          id: string
          marketplace: string | null
          user_id: string
          valid_until: string | null
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          id?: string
          marketplace?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          discount_text?: string | null
          id?: string
          marketplace?: string | null
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coupons_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      group_performance: {
        Row: {
          clicks: number
          commission: number
          created_at: string
          date: string
          group_id: string
          id: string
          publications_count: number
          revenue: number
          sales: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          commission?: number
          created_at?: string
          date: string
          group_id: string
          id?: string
          publications_count?: number
          revenue?: number
          sales?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          clicks?: number
          commission?: number
          created_at?: string
          date?: string
          group_id?: string
          id?: string
          publications_count?: number
          revenue?: number
          sales?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_performance_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_rules: {
        Row: {
          created_at: string
          field: string
          group_id: string
          id: string
          operator: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          field: string
          group_id: string
          id?: string
          operator: string
          user_id?: string
          value: string
        }
        Update: {
          created_at?: string
          field?: string
          group_id?: string
          id?: string
          operator?: string
          user_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_rules_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          active: boolean
          allowed_categories: string[]
          allowed_end: string
          allowed_start: string
          category: string | null
          created_at: string
          daily_limit: number
          description: string | null
          id: string
          identifier: string | null
          interval_minutes: number
          min_score: number
          name: string
          platform: Database["public"]["Enums"]["channel_platform"]
          status: Database["public"]["Enums"]["connection_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          allowed_categories?: string[]
          allowed_end?: string
          allowed_start?: string
          category?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          id?: string
          identifier?: string | null
          interval_minutes?: number
          min_score?: number
          name: string
          platform?: Database["public"]["Enums"]["channel_platform"]
          status?: Database["public"]["Enums"]["connection_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          allowed_categories?: string[]
          allowed_end?: string
          allowed_start?: string
          category?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          id?: string
          identifier?: string | null
          interval_minutes?: number
          min_score?: number
          name?: string
          platform?: Database["public"]["Enums"]["channel_platform"]
          status?: Database["public"]["Enums"]["connection_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_template_fk"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          credentials: Json
          id: string
          kind: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credentials?: Json
          id?: string
          kind: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          credentials?: Json
          id?: string
          kind?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplace_connections: {
        Row: {
          auto_sync_interval: string | null
          created_at: string
          id: string
          last_error: string | null
          last_sync_at: string | null
          marketplace: string
          settings: Json
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          auto_sync_interval?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace: string
          settings?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          auto_sync_interval?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          last_sync_at?: string | null
          marketplace?: string
          settings?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_connections_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      marketplace_sync_logs: {
        Row: {
          created_at: string
          error_count: number
          finished_at: string | null
          id: string
          items_found: number
          items_imported: number
          items_skipped: number
          items_updated: number
          last_error: string | null
          marketplace: string
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          items_found?: number
          items_imported?: number
          items_skipped?: number
          items_updated?: number
          last_error?: string | null
          marketplace: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          error_count?: number
          finished_at?: string | null
          id?: string
          items_found?: number
          items_imported?: number
          items_skipped?: number
          items_updated?: number
          last_error?: string | null
          marketplace?: string
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      marketplaces: {
        Row: {
          color: string
          docs_url: string | null
          is_active: boolean
          name: string
          short_label: string
          slug: string
          sort_order: number
        }
        Insert: {
          color?: string
          docs_url?: string | null
          is_active?: boolean
          name: string
          short_label?: string
          slug: string
          sort_order?: number
        }
        Update: {
          color?: string
          docs_url?: string | null
          is_active?: boolean
          name?: string
          short_label?: string
          slug?: string
          sort_order?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          type?: string
          user_id?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offer_performance: {
        Row: {
          clicks: number
          commission: number
          conversions: number
          created_at: string
          date: string
          id: string
          impressions: number
          offer_id: string
          revenue: number
          updated_at: string
          user_id: string
        }
        Insert: {
          clicks?: number
          commission?: number
          conversions?: number
          created_at?: string
          date: string
          id?: string
          impressions?: number
          offer_id: string
          revenue?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          clicks?: number
          commission?: number
          conversions?: number
          created_at?: string
          date?: string
          id?: string
          impressions?: number
          offer_id?: string
          revenue?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_performance_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_price_history: {
        Row: {
          captured_at: string
          discount_pct: number | null
          id: string
          marketplace: string
          offer_id: string | null
          price: number
          product_id: string | null
          promo_price: number | null
          source: string | null
          user_id: string
        }
        Insert: {
          captured_at?: string
          discount_pct?: number | null
          id?: string
          marketplace: string
          offer_id?: string | null
          price: number
          product_id?: string | null
          promo_price?: number | null
          source?: string | null
          user_id?: string
        }
        Update: {
          captured_at?: string
          discount_pct?: number | null
          id?: string
          marketplace?: string
          offer_id?: string | null
          price?: number
          product_id?: string | null
          promo_price?: number | null
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_price_history_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_score_weights: {
        Row: {
          id: string
          updated_at: string
          user_id: string | null
          weights: Json
        }
        Insert: {
          id?: string
          updated_at?: string
          user_id?: string | null
          weights?: Json
        }
        Update: {
          id?: string
          updated_at?: string
          user_id?: string | null
          weights?: Json
        }
        Relationships: []
      }
      offer_scores: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          offer_id: string
          score: number
          user_id: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          offer_id: string
          score: number
          user_id?: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          offer_id?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_scores_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          affiliate_url: string | null
          available: boolean
          category: string | null
          commission: number | null
          commission_pct: number | null
          coupon: string | null
          created_at: string
          discount_pct: number
          fingerprint: string | null
          free_shipping: boolean
          id: string
          image_url: string | null
          is_demo: boolean
          marketplace: string
          original_url: string | null
          previous_price: number | null
          price: number
          product_id: string | null
          rating: number | null
          rating_count: number | null
          sales_count: number | null
          score: number
          source_id: string | null
          status: Database["public"]["Enums"]["offer_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_url?: string | null
          available?: boolean
          category?: string | null
          commission?: number | null
          commission_pct?: number | null
          coupon?: string | null
          created_at?: string
          discount_pct?: number
          fingerprint?: string | null
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          marketplace: string
          original_url?: string | null
          previous_price?: number | null
          price: number
          product_id?: string | null
          rating?: number | null
          rating_count?: number | null
          sales_count?: number | null
          score?: number
          source_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          affiliate_url?: string | null
          available?: boolean
          category?: string | null
          commission?: number | null
          commission_pct?: number | null
          coupon?: string | null
          created_at?: string
          discount_pct?: number
          fingerprint?: string | null
          free_shipping?: boolean
          id?: string
          image_url?: string | null
          is_demo?: boolean
          marketplace?: string
          original_url?: string | null
          previous_price?: number | null
          price?: number
          product_id?: string | null
          rating?: number | null
          rating_count?: number | null
          sales_count?: number | null
          score?: number
          source_id?: string | null
          status?: Database["public"]["Enums"]["offer_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_limits: {
        Row: {
          analytics_retention_days: number
          created_at: string
          features: Json
          id: string
          max_automations: number
          max_groups: number
          max_products: number
          max_publications_per_day: number
          max_sources: number
          max_templates: number
          plan: string
          updated_at: string
        }
        Insert: {
          analytics_retention_days?: number
          created_at?: string
          features?: Json
          id?: string
          max_automations?: number
          max_groups?: number
          max_products?: number
          max_publications_per_day?: number
          max_sources?: number
          max_templates?: number
          plan: string
          updated_at?: string
        }
        Update: {
          analytics_retention_days?: number
          created_at?: string
          features?: Json
          id?: string
          max_automations?: number
          max_groups?: number
          max_products?: number
          max_publications_per_day?: number
          max_sources?: number
          max_templates?: number
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          created_at: string
          id: string
          marketplace: string
          offer_id: string | null
          product_id: string | null
          status: string
          target_discount_pct: number | null
          target_price: number | null
          triggered_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          marketplace: string
          offer_id?: string | null
          product_id?: string | null
          status?: string
          target_discount_pct?: number | null
          target_price?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          marketplace?: string
          offer_id?: string | null
          product_id?: string | null
          status?: string
          target_discount_pct?: number | null
          target_price?: number | null
          triggered_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_alerts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_prices: {
        Row: {
          available: boolean
          captured_at: string
          coupon: string | null
          id: string
          marketplace: string
          price: number
          product_id: string
          promo_price: number | null
          user_id: string
        }
        Insert: {
          available?: boolean
          captured_at?: string
          coupon?: string | null
          id?: string
          marketplace: string
          price: number
          product_id: string
          promo_price?: number | null
          user_id?: string
        }
        Update: {
          available?: boolean
          captured_at?: string
          coupon?: string | null
          id?: string
          marketplace?: string
          price?: number
          product_id?: string
          promo_price?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          created_at: string
          external_id: string | null
          id: string
          image_url: string | null
          is_demo: boolean
          marketplace: string
          rating: number | null
          rating_count: number | null
          sales_count: number | null
          sku: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          marketplace: string
          rating?: number | null
          rating_count?: number | null
          sales_count?: number | null
          sku?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          image_url?: string | null
          is_demo?: boolean
          marketplace?: string
          rating?: number | null
          rating_count?: number | null
          sales_count?: number | null
          sku?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          demo_mode: boolean
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          demo_mode?: boolean
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          demo_mode?: boolean
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      publication_queue: {
        Row: {
          attempts: number
          automation_id: string | null
          content: string | null
          created_at: string
          group_id: string | null
          id: string
          last_error: string | null
          offer_id: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["queue_status"]
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          automation_id?: string | null
          content?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          last_error?: string | null
          offer_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          attempts?: number
          automation_id?: string | null
          content?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          last_error?: string | null
          offer_id?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publication_queue_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_queue_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publication_queue_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      publications: {
        Row: {
          attempts: number
          content: string | null
          error: string | null
          group_id: string | null
          id: string
          link: string | null
          marketplace: string | null
          offer_id: string | null
          published_at: string
          status: Database["public"]["Enums"]["queue_status"]
          template_id: string | null
          title: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          content?: string | null
          error?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          marketplace?: string | null
          offer_id?: string | null
          published_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          template_id?: string | null
          title?: string | null
          user_id?: string
        }
        Update: {
          attempts?: number
          content?: string | null
          error?: string | null
          group_id?: string | null
          id?: string
          link?: string | null
          marketplace?: string | null
          offer_id?: string | null
          published_at?: string
          status?: Database["public"]["Enums"]["queue_status"]
          template_id?: string | null
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "publications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "publications_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      retry_queue: {
        Row: {
          attempts: number
          channel: string
          created_at: string
          destination_id: string
          id: string
          last_error: string | null
          max_attempts: number
          next_retry_at: string
          payload: Json
          publication_id: string | null
          queue_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          channel: string
          created_at?: string
          destination_id: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload: Json
          publication_id?: string | null
          queue_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          attempts?: number
          channel?: string
          created_at?: string
          destination_id?: string
          id?: string
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string
          payload?: Json
          publication_id?: string | null
          queue_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "retry_queue_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "retry_queue_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "publication_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      source_messages: {
        Row: {
          created_at: string
          error: string | null
          id: string
          image_url: string | null
          link: string | null
          marketplace: string | null
          offer_id: string | null
          processed: boolean
          raw_text: string | null
          source_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          marketplace?: string | null
          offer_id?: string | null
          processed?: boolean
          raw_text?: string | null
          source_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          image_url?: string | null
          link?: string | null
          marketplace?: string | null
          offer_id?: string | null
          processed?: boolean
          raw_text?: string | null
          source_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "source_messages_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "source_messages_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      sources: {
        Row: {
          authorized: boolean
          created_at: string
          id: string
          identifier: string | null
          marketplace: string | null
          name: string
          settings: Json
          status: Database["public"]["Enums"]["connection_status"]
          type: Database["public"]["Enums"]["source_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          authorized?: boolean
          created_at?: string
          id?: string
          identifier?: string | null
          marketplace?: string | null
          name: string
          settings?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string
        }
        Update: {
          authorized?: boolean
          created_at?: string
          id?: string
          identifier?: string | null
          marketplace?: string | null
          name?: string
          settings?: Json
          status?: Database["public"]["Enums"]["connection_status"]
          type?: Database["public"]["Enums"]["source_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sources_marketplace_fkey"
            columns: ["marketplace"]
            isOneToOne: false
            referencedRelation: "marketplaces"
            referencedColumns: ["slug"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          plan: Database["public"]["Enums"]["plan_tier"]
          provider: string | null
          provider_customer_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          plan?: Database["public"]["Enums"]["plan_tier"]
          provider?: string | null
          provider_customer_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      system_notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read: boolean
          sent_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read?: boolean
          sent_at?: string | null
          title: string
          type: string
          user_id?: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read?: boolean
          sent_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          body: string
          created_at: string
          cta: string | null
          id: string
          is_default: boolean
          name: string
          signature: string | null
          style: string
          title: string | null
          updated_at: string
          use_emojis: boolean
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          cta?: string | null
          id?: string
          is_default?: boolean
          name: string
          signature?: string | null
          style?: string
          title?: string | null
          updated_at?: string
          use_emojis?: boolean
          user_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          cta?: string | null
          id?: string
          is_default?: boolean
          name?: string
          signature?: string | null
          style?: string
          title?: string | null
          updated_at?: string
          use_emojis?: boolean
          user_id?: string
        }
        Relationships: []
      }
      tracking_links: {
        Row: {
          affiliate_link_id: string | null
          clicks: number
          commission: number
          conversions: number
          created_at: string
          destination_url: string
          group_id: string | null
          id: string
          last_clicked_at: string | null
          marketplace: string | null
          offer_id: string | null
          publication_id: string | null
          revenue: number
          short_code: string
          unique_clicks: number
          updated_at: string
          user_id: string
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
        }
        Insert: {
          affiliate_link_id?: string | null
          clicks?: number
          commission?: number
          conversions?: number
          created_at?: string
          destination_url: string
          group_id?: string | null
          id?: string
          last_clicked_at?: string | null
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          revenue?: number
          short_code: string
          unique_clicks?: number
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Update: {
          affiliate_link_id?: string | null
          clicks?: number
          commission?: number
          conversions?: number
          created_at?: string
          destination_url?: string
          group_id?: string | null
          id?: string
          last_clicked_at?: string | null
          marketplace?: string | null
          offer_id?: string | null
          publication_id?: string | null
          revenue?: number
          short_code?: string
          unique_clicks?: number
          updated_at?: string
          user_id?: string
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracking_links_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_links_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_links_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_links_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "publications"
            referencedColumns: ["id"]
          },
        ]
      }
      user_brand: {
        Row: {
          brand_name: string | null
          created_at: string
          default_signature: string | null
          id: string
          logo_url: string | null
          primary_color: string | null
          secondary_color: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          brand_name?: string | null
          created_at?: string
          default_signature?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Update: {
          brand_name?: string | null
          created_at?: string
          default_signature?: string | null
          id?: string
          logo_url?: string | null
          primary_color?: string | null
          secondary_color?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          compact_mode: boolean
          created_at: string
          currency: string
          default_copy_template_id: string | null
          default_language: string
          default_tone: string
          id: string
          notify_browser: boolean
          notify_email: boolean
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          compact_mode?: boolean
          created_at?: string
          currency?: string
          default_copy_template_id?: string | null
          default_language?: string
          default_tone?: string
          id?: string
          notify_browser?: boolean
          notify_email?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          compact_mode?: boolean
          created_at?: string
          currency?: string
          default_copy_template_id?: string | null
          default_language?: string
          default_tone?: string
          id?: string
          notify_browser?: boolean
          notify_email?: boolean
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_copy_template_id_fkey"
            columns: ["default_copy_template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
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
      whatsapp_connections: {
        Row: {
          api_key: string | null
          api_url: string | null
          connected_at: string | null
          created_at: string
          disconnected_at: string | null
          display_name: string | null
          id: string
          instance_name: string | null
          last_seen_at: string | null
          phone_number: string | null
          provider: string
          qr_code: string | null
          session_identifier: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string | null
          last_seen_at?: string | null
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          session_identifier: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          connected_at?: string | null
          created_at?: string
          disconnected_at?: string | null
          display_name?: string | null
          id?: string
          instance_name?: string | null
          last_seen_at?: string | null
          phone_number?: string | null
          provider?: string
          qr_code?: string | null
          session_identifier?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_groups: {
        Row: {
          allowed_categories: string[]
          allowed_end_time: string
          allowed_marketplaces: string[]
          allowed_start_time: string
          category_id: string | null
          connection_id: string
          copy_template: string | null
          created_at: string
          daily_limit: number
          description: string | null
          external_group_id: string
          id: string
          image_url: string | null
          is_active: boolean
          is_selected: boolean
          last_synced_at: string | null
          minimum_discount: number
          minimum_offer_score: number
          name: string
          participant_count: number
          posting_interval_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allowed_categories?: string[]
          allowed_end_time?: string
          allowed_marketplaces?: string[]
          allowed_start_time?: string
          category_id?: string | null
          connection_id: string
          copy_template?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          external_group_id: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          minimum_discount?: number
          minimum_offer_score?: number
          name: string
          participant_count?: number
          posting_interval_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allowed_categories?: string[]
          allowed_end_time?: string
          allowed_marketplaces?: string[]
          allowed_start_time?: string
          category_id?: string | null
          connection_id?: string
          copy_template?: string | null
          created_at?: string
          daily_limit?: number
          description?: string | null
          external_group_id?: string
          id?: string
          image_url?: string | null
          is_active?: boolean
          is_selected?: boolean
          last_synced_at?: string | null
          minimum_discount?: number
          minimum_offer_score?: number
          name?: string
          participant_count?: number
          posting_interval_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_groups_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_logs: {
        Row: {
          attempt: number
          connection_id: string | null
          created_at: string
          group_name: string | null
          id: string
          offer_title: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          attempt?: number
          connection_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          offer_title?: string | null
          reason?: string | null
          status: string
          user_id: string
        }
        Update: {
          attempt?: number
          connection_id?: string | null
          created_at?: string
          group_name?: string | null
          id?: string
          offer_title?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_logs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_publication_queue: {
        Row: {
          attempts: number
          connection_id: string | null
          created_at: string
          group_id: string
          id: string
          last_error: string | null
          media_url: string | null
          message: string
          offer_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          group_id: string
          id?: string
          last_error?: string | null
          media_url?: string | null
          message: string
          offer_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          connection_id?: string | null
          created_at?: string
          group_id?: string
          id?: string
          last_error?: string | null
          media_url?: string | null
          message?: string
          offer_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_publication_queue_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_publication_queue_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_settings: {
        Row: {
          default_api_key: string | null
          default_api_url: string | null
          duplicate_window_hours: number
          global_daily_limit: number
          global_min_interval_minutes: number
          pause_on_disconnect: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          default_api_key?: string | null
          default_api_url?: string | null
          duplicate_window_hours?: number
          global_daily_limit?: number
          global_min_interval_minutes?: number
          pause_on_disconnect?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          default_api_key?: string | null
          default_api_url?: string | null
          duplicate_window_hours?: number
          global_daily_limit?: number
          global_min_interval_minutes?: number
          pause_on_disconnect?: boolean
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
      channel_platform: "whatsapp" | "telegram" | "other"
      connection_status:
        | "not_configured"
        | "pending"
        | "connected"
        | "error"
        | "disconnected"
      offer_status:
        | "new"
        | "approved"
        | "rejected"
        | "queued"
        | "published"
        | "archived"
      plan_tier: "free" | "basic" | "pro" | "business"
      queue_status:
        | "pending"
        | "scheduled"
        | "processing"
        | "published"
        | "failed"
        | "cancelled"
      source_type:
        | "marketplace"
        | "channel"
        | "group"
        | "feed"
        | "api"
        | "external"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      channel_platform: ["whatsapp", "telegram", "other"],
      connection_status: [
        "not_configured",
        "pending",
        "connected",
        "error",
        "disconnected",
      ],
      offer_status: [
        "new",
        "approved",
        "rejected",
        "queued",
        "published",
        "archived",
      ],
      plan_tier: ["free", "basic", "pro", "business"],
      queue_status: [
        "pending",
        "scheduled",
        "processing",
        "published",
        "failed",
        "cancelled",
      ],
      source_type: [
        "marketplace",
        "channel",
        "group",
        "feed",
        "api",
        "external",
      ],
    },
  },
} as const
