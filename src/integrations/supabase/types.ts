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
      automations: {
        Row: {
          active: boolean
          created_at: string
          daily_limit: number
          end_time: string
          group_id: string | null
          id: string
          interval_minutes: number
          name: string
          start_time: string
          template_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_limit?: number
          end_time?: string
          group_id?: string | null
          id?: string
          interval_minutes?: number
          name: string
          start_time?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_limit?: number
          end_time?: string
          group_id?: string | null
          id?: string
          interval_minutes?: number
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
