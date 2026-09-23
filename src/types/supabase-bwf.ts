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
      bwf_product_categories: {
        Row: {
          created_at: string | null
          id: string
          level: number
          name: string
          parent_id: string | null
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level?: number
          name: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level?: number
          name?: string
          parent_id?: string | null
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bwf_product_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "bwf_product_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_quote: {
        Row: {
          bwf_pitching_id: string | null
          bwf_project_id: string | null
          cost_price: number | null
          created_at: string | null
          exchange_rate: number | null
          hkd_cost_price: number | null
          id: string
          project_data: Json
          quote_id: string
          status: string
          submitter: string
          terms_content: Json | null
          total_amount: number
          version: string
        }
        Insert: {
          bwf_pitching_id?: string | null
          bwf_project_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          exchange_rate?: number | null
          hkd_cost_price?: number | null
          id?: string
          project_data?: Json
          quote_id: string
          status?: string
          submitter: string
          terms_content?: Json | null
          total_amount?: number
          version?: string
        }
        Update: {
          bwf_pitching_id?: string | null
          bwf_project_id?: string | null
          cost_price?: number | null
          created_at?: string | null
          exchange_rate?: number | null
          hkd_cost_price?: number | null
          id?: string
          project_data?: Json
          quote_id?: string
          status?: string
          submitter?: string
          terms_content?: Json | null
          total_amount?: number
          version?: string
        }
        Relationships: []
      }
      client_companies: {
        Row: {
          address: string | null
          contact_email: string | null
          contact_person: string | null
          contact_phone: string | null
          created_at: string | null
          id: string
          name: string
          pending_changes: Json
          updated_at: string | null
        }
        Insert: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name: string
          pending_changes?: Json
          updated_at?: string | null
        }
        Update: {
          address?: string | null
          contact_email?: string | null
          contact_person?: string | null
          contact_phone?: string | null
          created_at?: string | null
          id?: string
          name?: string
          pending_changes?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      delivery_terms: {
        Row: {
          created_at: string | null
          id: string
          max_days: number
          min_days: number
          name: string
          parent_id: string | null
          sort_order: number
          type: Database["public"]["Enums"]["delivery_term_type"]
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          max_days?: number
          min_days?: number
          name: string
          parent_id?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["delivery_term_type"]
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          max_days?: number
          min_days?: number
          name?: string
          parent_id?: string | null
          sort_order?: number
          type?: Database["public"]["Enums"]["delivery_term_type"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_terms_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "delivery_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      design_projects: {
        Row: {
          active_scheme: string
          client_company: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          floor_plan_type: string | null
          floor_plan_url: string | null
          id: string
          meta: Json
          name: string
          progress: number
          status: string
          updated_at: string | null
        }
        Insert: {
          active_scheme?: string
          client_company?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          floor_plan_type?: string | null
          floor_plan_url?: string | null
          id?: string
          meta?: Json
          name: string
          progress?: number
          status?: string
          updated_at?: string | null
        }
        Update: {
          active_scheme?: string
          client_company?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          floor_plan_type?: string | null
          floor_plan_url?: string | null
          id?: string
          meta?: Json
          name?: string
          progress?: number
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      factory_correction_patterns: {
        Row: {
          confidence: number | null
          corrected_value: string
          correction_context: Json | null
          created_at: string | null
          factory_id: string
          factory_name: string
          field_name: string
          id: string
          model_number: string | null
          occurrence_count: number | null
          original_value: string | null
          updated_at: string | null
        }
        Insert: {
          confidence?: number | null
          corrected_value: string
          correction_context?: Json | null
          created_at?: string | null
          factory_id: string
          factory_name: string
          field_name: string
          id?: string
          model_number?: string | null
          occurrence_count?: number | null
          original_value?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence?: number | null
          corrected_value?: string
          correction_context?: Json | null
          created_at?: string | null
          factory_id?: string
          factory_name?: string
          field_name?: string
          id?: string
          model_number?: string | null
          occurrence_count?: number | null
          original_value?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_category: {
        Row: {
          created_at: string | null
          id: string
          level1: string
          level2: string
          sort_order: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          level1: string
          level2: string
          sort_order?: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          level1?: string
          level2?: string
          sort_order?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      product_discussions: {
        Row: {
          author: string
          author_role: string
          body: string
          created_at: string | null
          id: string
          mentions: string[]
          project_id: string
          zone_product_id: string | null
        }
        Insert: {
          author: string
          author_role?: string
          body: string
          created_at?: string | null
          id?: string
          mentions?: string[]
          project_id: string
          zone_product_id?: string | null
        }
        Update: {
          author?: string
          author_role?: string
          body?: string
          created_at?: string | null
          id?: string
          mentions?: string[]
          project_id?: string
          zone_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_discussions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_discussions_zone_product_id_fkey"
            columns: ["zone_product_id"]
            isOneToOne: false
            referencedRelation: "zone_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          color: string
          id: string
          inventory: number
          price: number
          product_id: string
          size: string
          sku: string
        }
        Insert: {
          color?: string
          id: string
          inventory?: number
          price?: number
          product_id: string
          size?: string
          sku?: string
        }
        Update: {
          color?: string
          id?: string
          inventory?: number
          price?: number
          product_id?: string
          size?: string
          sku?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bwf_master_id: string | null
          category: string | null
          collection: string
          color: string | null
          compare_at_price: number | null
          copy_done: boolean
          copy_done_at: string | null
          copy_queued_at: string | null
          cost_price: number | null
          created_at: string
          customize: string | null
          delivery_term_id: string | null
          delivery_term_name: string | null
          description: string
          description_html: string | null
          dimension_h_mm: number | null
          dimension_l_mm: number | null
          dimension_w_mm: number | null
          dismissed: boolean
          error_message: string | null
          factories_display_name: string | null
          factory_highlights: string[] | null
          factory_id: string | null
          id: string
          image_url: string
          image_url_2: string | null
          image_url_3: string | null
          images: Json | null
          in_catalog: boolean
          in_shopify_queue: boolean
          in_stock: boolean | null
          info_done: boolean
          level1_category: string | null
          level2_category: string | null
          lifestyle_image_url: string | null
          material: string | null
          model: string | null
          price: number
          product_sku: string | null
          production_date: string | null
          production_time: string | null
          ready_to_publish: boolean
          remarks: string | null
          revert_reason: Json | null
          sale_price: number | null
          shipping_days: number | null
          shipping_fee: number | null
          shopify_product_id: string | null
          shopify_synced_data: Json | null
          sku: string | null
          source: string
          specifications: string | null
          status: string
          synced_at: string | null
          tags: string[]
          title: string
          total_lead_time: number | null
          upload_session_id: string | null
        }
        Insert: {
          bwf_master_id?: string | null
          category?: string | null
          collection?: string
          color?: string | null
          compare_at_price?: number | null
          copy_done?: boolean
          copy_done_at?: string | null
          copy_queued_at?: string | null
          cost_price?: number | null
          created_at?: string
          customize?: string | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string
          description_html?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          dismissed?: boolean
          error_message?: string | null
          factories_display_name?: string | null
          factory_highlights?: string[] | null
          factory_id?: string | null
          id: string
          image_url?: string
          image_url_2?: string | null
          image_url_3?: string | null
          images?: Json | null
          in_catalog?: boolean
          in_shopify_queue?: boolean
          in_stock?: boolean | null
          info_done?: boolean
          level1_category?: string | null
          level2_category?: string | null
          lifestyle_image_url?: string | null
          material?: string | null
          model?: string | null
          price?: number
          product_sku?: string | null
          production_date?: string | null
          production_time?: string | null
          ready_to_publish?: boolean
          remarks?: string | null
          revert_reason?: Json | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_product_id?: string | null
          shopify_synced_data?: Json | null
          sku?: string | null
          source?: string
          specifications?: string | null
          status?: string
          synced_at?: string | null
          tags?: string[]
          title: string
          total_lead_time?: number | null
          upload_session_id?: string | null
        }
        Update: {
          bwf_master_id?: string | null
          category?: string | null
          collection?: string
          color?: string | null
          compare_at_price?: number | null
          copy_done?: boolean
          copy_done_at?: string | null
          copy_queued_at?: string | null
          cost_price?: number | null
          created_at?: string
          customize?: string | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string
          description_html?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          dismissed?: boolean
          error_message?: string | null
          factories_display_name?: string | null
          factory_highlights?: string[] | null
          factory_id?: string | null
          id?: string
          image_url?: string
          image_url_2?: string | null
          image_url_3?: string | null
          images?: Json | null
          in_catalog?: boolean
          in_shopify_queue?: boolean
          in_stock?: boolean | null
          info_done?: boolean
          level1_category?: string | null
          level2_category?: string | null
          lifestyle_image_url?: string | null
          material?: string | null
          model?: string | null
          price?: number
          product_sku?: string | null
          production_date?: string | null
          production_time?: string | null
          ready_to_publish?: boolean
          remarks?: string | null
          revert_reason?: Json | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_product_id?: string | null
          shopify_synced_data?: Json | null
          sku?: string | null
          source?: string
          specifications?: string | null
          status?: string
          synced_at?: string | null
          tags?: string[]
          title?: string
          total_lead_time?: number | null
          upload_session_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_delivery_term_id_fkey"
            columns: ["delivery_term_id"]
            isOneToOne: false
            referencedRelation: "delivery_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      project_invitations: {
        Row: {
          channel: string
          created_at: string | null
          email: string | null
          id: string
          project_id: string
          share_token: string
          status: string
          viewed_at: string | null
        }
        Insert: {
          channel?: string
          created_at?: string | null
          email?: string | null
          id?: string
          project_id: string
          share_token: string
          status?: string
          viewed_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          email?: string | null
          id?: string
          project_id?: string
          share_token?: string
          status?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_invitations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_zones: {
        Row: {
          ai_suggested: boolean
          bounds: Json
          code: string | null
          created_at: string | null
          id: string
          name: string
          project_id: string
          sort_order: number
        }
        Insert: {
          ai_suggested?: boolean
          bounds?: Json
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          project_id: string
          sort_order?: number
        }
        Update: {
          ai_suggested?: boolean
          bounds?: Json
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          project_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_zones_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ready_to_shopify: {
        Row: {
          body_html: string | null
          color: string | null
          compare_at_price: number | null
          cost: number | null
          customize: string | null
          dimension_h_mm: number | null
          dimension_l_mm: number | null
          dimension_w_mm: number | null
          factory_id: string | null
          furniture_group_checked: boolean | null
          handle: string | null
          id: string
          image_url: string | null
          image_url_2: string | null
          image_url_3: string | null
          images: Json | null
          imported_at: string
          in_stock: boolean | null
          material: string | null
          "my_fields.materials": string | null
          price: number | null
          product_id: string | null
          product_type: string | null
          production_time: string | null
          published_at: string | null
          remarks: string | null
          shop_domain: string | null
          shopify_created_at: string | null
          shopify_page_description: string | null
          shopify_page_title: string | null
          shopify_product_id: string | null
          shopify_updated_at: string | null
          shopify_url: string | null
          sku: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          variants: Json | null
          vendor: string | null
        }
        Insert: {
          body_html?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost?: number | null
          customize?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factory_id?: string | null
          furniture_group_checked?: boolean | null
          handle?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          images?: Json | null
          imported_at?: string
          in_stock?: boolean | null
          material?: string | null
          "my_fields.materials"?: string | null
          price?: number | null
          product_id?: string | null
          product_type?: string | null
          production_time?: string | null
          published_at?: string | null
          remarks?: string | null
          shop_domain?: string | null
          shopify_created_at?: string | null
          shopify_page_description?: string | null
          shopify_page_title?: string | null
          shopify_product_id?: string | null
          shopify_updated_at?: string | null
          shopify_url?: string | null
          sku?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          variants?: Json | null
          vendor?: string | null
        }
        Update: {
          body_html?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost?: number | null
          customize?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factory_id?: string | null
          furniture_group_checked?: boolean | null
          handle?: string | null
          id?: string
          image_url?: string | null
          image_url_2?: string | null
          image_url_3?: string | null
          images?: Json | null
          imported_at?: string
          in_stock?: boolean | null
          material?: string | null
          "my_fields.materials"?: string | null
          price?: number | null
          product_id?: string | null
          product_type?: string | null
          production_time?: string | null
          published_at?: string | null
          remarks?: string | null
          shop_domain?: string | null
          shopify_created_at?: string | null
          shopify_page_description?: string | null
          shopify_page_title?: string | null
          shopify_product_id?: string | null
          shopify_updated_at?: string | null
          shopify_url?: string | null
          sku?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          variants?: Json | null
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ready_to_shopify_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      rejectedd_products: {
        Row: {
          bwf_master_id: string | null
          category: string | null
          collection: string | null
          color: string | null
          compare_at_price: number | null
          cost_price: number | null
          customize: string | null
          delivery_term_id: string | null
          delivery_term_name: string | null
          description: string | null
          description_html: string | null
          dimension_h_mm: number | null
          dimension_l_mm: number | null
          dimension_w_mm: number | null
          factories_display_name: string | null
          factory_id: string | null
          id: string
          image_url: string | null
          images: Json | null
          in_stock: boolean | null
          level1_category: string | null
          level2_category: string | null
          material: string | null
          model: string | null
          original_product_id: string | null
          price: number | null
          product_sku: string | null
          production_lead_time: number | null
          production_time: string | null
          rejected_at: string
          rejection_source: string | null
          remarks: string | null
          sale_price: number | null
          shipping_days: number | null
          shipping_fee: number | null
          shopify_product_id: string | null
          source: string | null
          specifications: string | null
          status: string | null
          synced_at: string | null
          tags: string[] | null
          title: string | null
          total_lead_time: number | null
          variants: Json | null
        }
        Insert: {
          bwf_master_id?: string | null
          category?: string | null
          collection?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          customize?: string | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string | null
          description_html?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factories_display_name?: string | null
          factory_id?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          in_stock?: boolean | null
          level1_category?: string | null
          level2_category?: string | null
          material?: string | null
          model?: string | null
          original_product_id?: string | null
          price?: number | null
          product_sku?: string | null
          production_lead_time?: number | null
          production_time?: string | null
          rejected_at?: string
          rejection_source?: string | null
          remarks?: string | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_product_id?: string | null
          source?: string | null
          specifications?: string | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          title?: string | null
          total_lead_time?: number | null
          variants?: Json | null
        }
        Update: {
          bwf_master_id?: string | null
          category?: string | null
          collection?: string | null
          color?: string | null
          compare_at_price?: number | null
          cost_price?: number | null
          customize?: string | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string | null
          description_html?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factories_display_name?: string | null
          factory_id?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          in_stock?: boolean | null
          level1_category?: string | null
          level2_category?: string | null
          material?: string | null
          model?: string | null
          original_product_id?: string | null
          price?: number | null
          product_sku?: string | null
          production_lead_time?: number | null
          production_time?: string | null
          rejected_at?: string
          rejection_source?: string | null
          remarks?: string | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_product_id?: string | null
          source?: string | null
          specifications?: string | null
          status?: string | null
          synced_at?: string | null
          tags?: string[] | null
          title?: string | null
          total_lead_time?: number | null
          variants?: Json | null
        }
        Relationships: []
      }
      shopify_connections: {
        Row: {
          access_token: string
          client_id: string | null
          client_secret: string | null
          connected_at: string | null
          is_active: boolean | null
          last_refresh_error: string | null
          refresh_attempt_count: number | null
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          shop_domain: string
          token_expires_at: string | null
          updated_at: string | null
        }
        Insert: {
          access_token: string
          client_id?: string | null
          client_secret?: string | null
          connected_at?: string | null
          is_active?: boolean | null
          last_refresh_error?: string | null
          refresh_attempt_count?: number | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          shop_domain: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          client_id?: string | null
          client_secret?: string | null
          connected_at?: string | null
          is_active?: boolean | null
          last_refresh_error?: string | null
          refresh_attempt_count?: number | null
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          shop_domain?: string
          token_expires_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shopify_products: {
        Row: {
          body_html: string | null
          compare_at_price: number | null
          "custom.more_image_alt_1": string | null
          "custom.more_image_alt_2": string | null
          "custom.more_image_alt_3": string | null
          "custom.more_image_alt_4": string | null
          "custom.more_image_link_1": string | null
          "custom.more_image_link_2": string | null
          "custom.more_image_link_3": string | null
          "custom.more_image_link_4": string | null
          customize: string | null
          handle: string | null
          id: string
          image_url: string | null
          images: Json | null
          imported_at: string
          in_stock: boolean | null
          metafields: Json | null
          "my_fields.image_alt": string | null
          "my_fields.image_link": string | null
          "my_fields.materials": string | null
          "my_fields.more_recommend_size": string | null
          "my_fields.normal_size": string | null
          "my_fields.production_time": string | null
          "my_fields.recommend_size": string | null
          "my_fields.video_link": string | null
          options: Json | null
          price: number | null
          product_type: string | null
          published_at: string | null
          ready_to_shopify_id: string | null
          shop_domain: string | null
          shopify_created_at: string | null
          shopify_product_id: string
          shopify_updated_at: string | null
          "shopify.color-pattern": string | null
          sku: string | null
          source_product_id: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          variants: Json | null
          vendor: string | null
        }
        Insert: {
          body_html?: string | null
          compare_at_price?: number | null
          "custom.more_image_alt_1"?: string | null
          "custom.more_image_alt_2"?: string | null
          "custom.more_image_alt_3"?: string | null
          "custom.more_image_alt_4"?: string | null
          "custom.more_image_link_1"?: string | null
          "custom.more_image_link_2"?: string | null
          "custom.more_image_link_3"?: string | null
          "custom.more_image_link_4"?: string | null
          customize?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          imported_at?: string
          in_stock?: boolean | null
          metafields?: Json | null
          "my_fields.image_alt"?: string | null
          "my_fields.image_link"?: string | null
          "my_fields.materials"?: string | null
          "my_fields.more_recommend_size"?: string | null
          "my_fields.normal_size"?: string | null
          "my_fields.production_time"?: string | null
          "my_fields.recommend_size"?: string | null
          "my_fields.video_link"?: string | null
          options?: Json | null
          price?: number | null
          product_type?: string | null
          published_at?: string | null
          ready_to_shopify_id?: string | null
          shop_domain?: string | null
          shopify_created_at?: string | null
          shopify_product_id: string
          shopify_updated_at?: string | null
          "shopify.color-pattern"?: string | null
          sku?: string | null
          source_product_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          variants?: Json | null
          vendor?: string | null
        }
        Update: {
          body_html?: string | null
          compare_at_price?: number | null
          "custom.more_image_alt_1"?: string | null
          "custom.more_image_alt_2"?: string | null
          "custom.more_image_alt_3"?: string | null
          "custom.more_image_alt_4"?: string | null
          "custom.more_image_link_1"?: string | null
          "custom.more_image_link_2"?: string | null
          "custom.more_image_link_3"?: string | null
          "custom.more_image_link_4"?: string | null
          customize?: string | null
          handle?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          imported_at?: string
          in_stock?: boolean | null
          metafields?: Json | null
          "my_fields.image_alt"?: string | null
          "my_fields.image_link"?: string | null
          "my_fields.materials"?: string | null
          "my_fields.more_recommend_size"?: string | null
          "my_fields.normal_size"?: string | null
          "my_fields.production_time"?: string | null
          "my_fields.recommend_size"?: string | null
          "my_fields.video_link"?: string | null
          options?: Json | null
          price?: number | null
          product_type?: string | null
          published_at?: string | null
          ready_to_shopify_id?: string | null
          shop_domain?: string | null
          shopify_created_at?: string | null
          shopify_product_id?: string
          shopify_updated_at?: string | null
          "shopify.color-pattern"?: string | null
          sku?: string | null
          source_product_id?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          variants?: Json | null
          vendor?: string | null
        }
        Relationships: []
      }
      zone_products: {
        Row: {
          created_at: string | null
          id: string
          product_id: string | null
          product_image_url: string | null
          product_title: string | null
          project_id: string
          quantity: number
          sale_price: number | null
          scheme: string
          sort_order: number
          status: string
          zone_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_title?: string | null
          project_id: string
          quantity?: number
          sale_price?: number | null
          scheme?: string
          sort_order?: number
          status?: string
          zone_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string | null
          product_image_url?: string | null
          product_title?: string | null
          project_id?: string
          quantity?: number
          sale_price?: number | null
          scheme?: string
          sort_order?: number
          status?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_products_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "design_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_products_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "project_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      upsert_factory_correction: {
        Args: {
          p_context?: Json
          p_corrected_value: string
          p_factory_id: string
          p_factory_name: string
          p_field_name: string
          p_model_number?: string
          p_original_value: string
        }
        Returns: undefined
      }
    }
    Enums: {
      delivery_term_type: "stock" | "custom"
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
      delivery_term_type: ["stock", "custom"],
    },
  },
} as const
