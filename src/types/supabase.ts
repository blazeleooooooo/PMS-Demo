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
      ai_prompt_by_project_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          project_type: string | null
          prompt: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          project_type?: string | null
          prompt?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          project_type?: string | null
          prompt?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_prompt_by_project_types_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quote_demo_items: {
        Row: {
          amount: number | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          item_description: string | null
          item_name: string | null
          modified_date: string | null
          price: number | null
          quantity: number | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item_description?: string | null
          item_name?: string | null
          modified_date?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item_description?: string | null
          item_name?: string | null
          modified_date?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_quote_demo_items_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quote_sub_item_details: {
        Row: {
          ai_quote: string | null
          ai_quote_id: string | null
          ai_quote_sub_item: string | null
          ai_quote_sub_item_id: string | null
          amount: number | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          id: string
          item_index: string | null
          modified_date: string | null
          quantity: number | null
          slug: string | null
          unit_price: number | null
        }
        Insert: {
          ai_quote?: string | null
          ai_quote_id?: string | null
          ai_quote_sub_item?: string | null
          ai_quote_sub_item_id?: string | null
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item_index?: string | null
          modified_date?: string | null
          quantity?: number | null
          slug?: string | null
          unit_price?: number | null
        }
        Update: {
          ai_quote?: string | null
          ai_quote_id?: string | null
          ai_quote_sub_item?: string | null
          ai_quote_sub_item_id?: string | null
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item_index?: string | null
          modified_date?: string | null
          quantity?: number | null
          slug?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_quote_sub_item_details_ai_quote_id"
            columns: ["ai_quote_id"]
            isOneToOne: false
            referencedRelation: "ai_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_quote_sub_item_details_ai_quote_sub_item_id"
            columns: ["ai_quote_sub_item_id"]
            isOneToOne: false
            referencedRelation: "ai_quote_sub_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_quote_sub_item_details_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quote_sub_items: {
        Row: {
          ai_quote: string | null
          ai_quote_id: string | null
          amount: number | null
          bubble_id: string | null
          checked: boolean | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          item_content: string | null
          item_description: string | null
          item_index: string | null
          item_name: string | null
          modified_date: string | null
          o_item_type: string | null
          price: number | null
          quantity: number | null
          quantity_text: string | null
          slug: string | null
          unit: string | null
        }
        Insert: {
          ai_quote?: string | null
          ai_quote_id?: string | null
          amount?: number | null
          bubble_id?: string | null
          checked?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item_content?: string | null
          item_description?: string | null
          item_index?: string | null
          item_name?: string | null
          modified_date?: string | null
          o_item_type?: string | null
          price?: number | null
          quantity?: number | null
          quantity_text?: string | null
          slug?: string | null
          unit?: string | null
        }
        Update: {
          ai_quote?: string | null
          ai_quote_id?: string | null
          amount?: number | null
          bubble_id?: string | null
          checked?: boolean | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item_content?: string | null
          item_description?: string | null
          item_index?: string | null
          item_name?: string | null
          modified_date?: string | null
          o_item_type?: string | null
          price?: number | null
          quantity?: number | null
          quantity_text?: string | null
          slug?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_quote_sub_items_ai_quote_id"
            columns: ["ai_quote_id"]
            isOneToOne: false
            referencedRelation: "ai_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ai_quote_sub_items_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_quotes: {
        Row: {
          additional_information: string | null
          ai_logic: string | null
          bank_information: string | null
          block_ai_until: string | null
          bubble_id: string | null
          c_address: string | null
          c_client_name: string | null
          c_company_name: string | null
          c_email: string | null
          c_industry: string | null
          c_phone: string | null
          c_purpose: string | null
          c_unique_product_service: string | null
          c_website_function: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          development_schedule: string | null
          discount_amount_monthly: number | null
          discount_amount_one_time: number | null
          discount_description_monthly: string | null
          discount_description_one_time: string | null
          discount_type: string | null
          effective_date: string | null
          enable_discount_monthly: boolean | null
          enable_discount_one_time: boolean | null
          excluded: string | null
          id: string
          issue_date: string | null
          item_index: string | null
          methodology_1: string | null
          methodology_2: string | null
          modified_date: string | null
          montly_amount: number | null
          n_cost_center: string | null
          negative_prompt: string | null
          note: string | null
          pm_name: string | null
          pm_phone: string | null
          project_name: string | null
          project_type: string | null
          quote_code: string | null
          selected_item_types: string | null
          service_type: string | null
          site_location: string | null
          slug: string | null
          t_and_c: string | null
          total_amount: number | null
        }
        Insert: {
          additional_information?: string | null
          ai_logic?: string | null
          bank_information?: string | null
          block_ai_until?: string | null
          bubble_id?: string | null
          c_address?: string | null
          c_client_name?: string | null
          c_company_name?: string | null
          c_email?: string | null
          c_industry?: string | null
          c_phone?: string | null
          c_purpose?: string | null
          c_unique_product_service?: string | null
          c_website_function?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          development_schedule?: string | null
          discount_amount_monthly?: number | null
          discount_amount_one_time?: number | null
          discount_description_monthly?: string | null
          discount_description_one_time?: string | null
          discount_type?: string | null
          effective_date?: string | null
          enable_discount_monthly?: boolean | null
          enable_discount_one_time?: boolean | null
          excluded?: string | null
          id?: string
          issue_date?: string | null
          item_index?: string | null
          methodology_1?: string | null
          methodology_2?: string | null
          modified_date?: string | null
          montly_amount?: number | null
          n_cost_center?: string | null
          negative_prompt?: string | null
          note?: string | null
          pm_name?: string | null
          pm_phone?: string | null
          project_name?: string | null
          project_type?: string | null
          quote_code?: string | null
          selected_item_types?: string | null
          service_type?: string | null
          site_location?: string | null
          slug?: string | null
          t_and_c?: string | null
          total_amount?: number | null
        }
        Update: {
          additional_information?: string | null
          ai_logic?: string | null
          bank_information?: string | null
          block_ai_until?: string | null
          bubble_id?: string | null
          c_address?: string | null
          c_client_name?: string | null
          c_company_name?: string | null
          c_email?: string | null
          c_industry?: string | null
          c_phone?: string | null
          c_purpose?: string | null
          c_unique_product_service?: string | null
          c_website_function?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          development_schedule?: string | null
          discount_amount_monthly?: number | null
          discount_amount_one_time?: number | null
          discount_description_monthly?: string | null
          discount_description_one_time?: string | null
          discount_type?: string | null
          effective_date?: string | null
          enable_discount_monthly?: boolean | null
          enable_discount_one_time?: boolean | null
          excluded?: string | null
          id?: string
          issue_date?: string | null
          item_index?: string | null
          methodology_1?: string | null
          methodology_2?: string | null
          modified_date?: string | null
          montly_amount?: number | null
          n_cost_center?: string | null
          negative_prompt?: string | null
          note?: string | null
          pm_name?: string | null
          pm_phone?: string | null
          project_name?: string | null
          project_type?: string | null
          quote_code?: string | null
          selected_item_types?: string | null
          service_type?: string | null
          site_location?: string | null
          slug?: string | null
          t_and_c?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ai_quotes_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      ap_report_remarks: {
        Row: {
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          project: string | null
          project_id: string | null
          remark: string | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          project?: string | null
          project_id?: string | null
          remark?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          project?: string | null
          project_id?: string | null
          remark?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ap_report_remarks_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ap_report_remarks_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ap_report_remarks_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ap_report_remarks_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      blocked_views: {
        Row: {
          blocked_bu: string | null
          blocked_bu_id: string | null
          blocked_member: string | null
          blocked_member_id: string | null
          blocked_position: string | null
          blocked_role: string | null
          blocked_team: string | null
          blocked_team_id: string | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
          view: string | null
        }
        Insert: {
          blocked_bu?: string | null
          blocked_bu_id?: string | null
          blocked_member?: string | null
          blocked_member_id?: string | null
          blocked_position?: string | null
          blocked_role?: string | null
          blocked_team?: string | null
          blocked_team_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          view?: string | null
        }
        Update: {
          blocked_bu?: string | null
          blocked_bu_id?: string | null
          blocked_member?: string | null
          blocked_member_id?: string | null
          blocked_position?: string | null
          blocked_role?: string | null
          blocked_team?: string | null
          blocked_team_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          view?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_blocked_views_blocked_bu_id"
            columns: ["blocked_bu_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blocked_views_blocked_member_id"
            columns: ["blocked_member_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blocked_views_blocked_team_id"
            columns: ["blocked_team_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_blocked_views_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      building_comments: {
        Row: {
          bubble_id: string | null
          building: string | null
          building_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          comment: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          evaluator: string | null
          evaluator_id: string | null
          id: string
          modified_date: string | null
          pitching: string | null
          pitching_id: string | null
          point: number | null
          project: string | null
          project_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          building?: string | null
          building_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          building?: string | null
          building_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_building_comments_building_id"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_comments_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_comments_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_comments_evaluator_id"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_comments_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_comments_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      building_contacts: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_building_contacts_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      building_files: {
        Row: {
          bubble_id: string | null
          building: string | null
          building_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          file: string | null
          file_name: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          building?: string | null
          building_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          building?: string | null
          building_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_building_files_building_id"
            columns: ["building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_building_files_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      buildings: {
        Row: {
          address: string | null
          address_eng: string | null
          bubble_id: string | null
          building_name: string | null
          building_name_eng: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          delivery_note: string | null
          district: string | null
          district_id: string | null
          first_contact: string | null
          guideline: string | null
          id: string
          modified_date: string | null
          noisy_control: string | null
          real_creator: string | null
          real_creator_id: string | null
          remarks: string | null
          second_contact: string | null
          slug: string | null
          third_contact: string | null
          vetting_approval_time: string | null
          x_comment: string | null
          x_display_name: string | null
          x_night_works: string | null
        }
        Insert: {
          address?: string | null
          address_eng?: string | null
          bubble_id?: string | null
          building_name?: string | null
          building_name_eng?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          delivery_note?: string | null
          district?: string | null
          district_id?: string | null
          first_contact?: string | null
          guideline?: string | null
          id?: string
          modified_date?: string | null
          noisy_control?: string | null
          real_creator?: string | null
          real_creator_id?: string | null
          remarks?: string | null
          second_contact?: string | null
          slug?: string | null
          third_contact?: string | null
          vetting_approval_time?: string | null
          x_comment?: string | null
          x_display_name?: string | null
          x_night_works?: string | null
        }
        Update: {
          address?: string | null
          address_eng?: string | null
          bubble_id?: string | null
          building_name?: string | null
          building_name_eng?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          delivery_note?: string | null
          district?: string | null
          district_id?: string | null
          first_contact?: string | null
          guideline?: string | null
          id?: string
          modified_date?: string | null
          noisy_control?: string | null
          real_creator?: string | null
          real_creator_id?: string | null
          remarks?: string | null
          second_contact?: string | null
          slug?: string | null
          third_contact?: string | null
          vetting_approval_time?: string | null
          x_comment?: string | null
          x_display_name?: string | null
          x_night_works?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_buildings_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_buildings_district_id"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_buildings_real_creator_id"
            columns: ["real_creator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      bwa_pitching_project_types: {
        Row: {
          id: string
          pitching_id: string | null
          project_type_id: string | null
        }
        Insert: {
          id?: string
          pitching_id?: string | null
          project_type_id?: string | null
        }
        Update: {
          id?: string
          pitching_id?: string | null
          project_type_id?: string | null
        }
        Relationships: []
      }
      bwa_pitching_service_types: {
        Row: {
          id: string
          pitching_id: string | null
          service_type_id: string | null
        }
        Insert: {
          id?: string
          pitching_id?: string | null
          service_type_id?: string | null
        }
        Update: {
          id?: string
          pitching_id?: string | null
          service_type_id?: string | null
        }
        Relationships: []
      }
      bwa_pitchings: {
        Row: {
          actual_size: string | null
          asana_link: string | null
          b2b_b2c: string | null
          bubble_id: string | null
          closed_reason: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          description: string | null
          district: string | null
          district_id: string | null
          enquiry_date: string | null
          estimated_expense: number | null
          estimated_income: number | null
          height_to_bs: string | null
          height_to_fc: string | null
          height_to_tc: string | null
          id: string
          main_designer: string | null
          main_designer_id: string | null
          main_pm: string | null
          main_pm_id: string | null
          modified_date: string | null
          more_pm: string | null
          more_pm_id: string | null
          n_financial_year: string | null
          n_financial_year_id: string | null
          n_project_types: string | null
          n_service_type: string | null
          n_service_type_id: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          os_money_size: string | null
          other_pm: string | null
          other_pm_id: string | null
          pitching_code: string | null
          pitching_stages: string | null
          quote_project_type_id: string | null
          r_building: string | null
          r_building_id: string | null
          real_building_name: string | null
          real_creator_member_name: string | null
          real_customer_co_name: string | null
          real_customer_display_name: string | null
          real_district_name: string | null
          send_email: boolean | null
          site_address: string | null
          site_photos: string | null
          size: string | null
          slug: string | null
          working_folder: string | null
        }
        Insert: {
          actual_size?: string | null
          asana_link?: string | null
          b2b_b2c?: string | null
          bubble_id?: string | null
          closed_reason?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          description?: string | null
          district?: string | null
          district_id?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          height_to_bs?: string | null
          height_to_fc?: string | null
          height_to_tc?: string | null
          id?: string
          main_designer?: string | null
          main_designer_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_project_types?: string | null
          n_service_type?: string | null
          n_service_type_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_money_size?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          pitching_code?: string | null
          pitching_stages?: string | null
          quote_project_type_id?: string | null
          r_building?: string | null
          r_building_id?: string | null
          real_building_name?: string | null
          real_creator_member_name?: string | null
          real_customer_co_name?: string | null
          real_customer_display_name?: string | null
          real_district_name?: string | null
          send_email?: boolean | null
          site_address?: string | null
          site_photos?: string | null
          size?: string | null
          slug?: string | null
          working_folder?: string | null
        }
        Update: {
          actual_size?: string | null
          asana_link?: string | null
          b2b_b2c?: string | null
          bubble_id?: string | null
          closed_reason?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          description?: string | null
          district?: string | null
          district_id?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          height_to_bs?: string | null
          height_to_fc?: string | null
          height_to_tc?: string | null
          id?: string
          main_designer?: string | null
          main_designer_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_project_types?: string | null
          n_service_type?: string | null
          n_service_type_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_money_size?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          pitching_code?: string | null
          pitching_stages?: string | null
          quote_project_type_id?: string | null
          r_building?: string | null
          r_building_id?: string | null
          real_building_name?: string | null
          real_creator_member_name?: string | null
          real_customer_co_name?: string | null
          real_customer_display_name?: string | null
          real_district_name?: string | null
          send_email?: boolean | null
          site_address?: string | null
          site_photos?: string | null
          size?: string | null
          slug?: string | null
          working_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bwa_pitchings_quote_project_type_id_fkey"
            columns: ["quote_project_type_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_district_id"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_main_designer_id"
            columns: ["main_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_main_pm_id"
            columns: ["main_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_more_pm_id"
            columns: ["more_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_n_financial_year_id"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_n_service_type_id"
            columns: ["n_service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_other_pm_id"
            columns: ["other_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_pitchings_r_building_id"
            columns: ["r_building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
        ]
      }
      bwa_project_project_types: {
        Row: {
          id: string
          project_id: string | null
          project_type_id: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          project_type_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          project_type_id?: string | null
        }
        Relationships: []
      }
      bwa_project_service_types: {
        Row: {
          id: string
          project_id: string | null
          service_type_id: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          service_type_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          service_type_id?: string | null
        }
        Relationships: []
      }
      bwa_projects: {
        Row: {
          actual_size: string | null
          asana_link: string | null
          b2b_b2c: string | null
          bubble_id: string | null
          cost_centre: string | null
          cost_centre_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          defect_done_date: string | null
          description: string | null
          e_outstanding_date: string | null
          enquiry_date: string | null
          estimated_expense: number | null
          estimated_income: number | null
          estimated_profit: number | null
          external_customer_name: string | null
          external_project_name: string | null
          fixed_search: string | null
          handover_date: string | null
          height_to_bs: string | null
          height_to_fc: string | null
          height_to_tc: string | null
          id: string
          income_below_estimated_reason: string | null
          main_air_supplier: string | null
          main_air_supplier_id: string | null
          main_contractor: string | null
          main_contractor_id: string | null
          main_designer: string | null
          main_designer_id: string | null
          main_divide: string | null
          main_network_supplier: string | null
          main_network_supplier_id: string | null
          main_pm: string | null
          main_pm_id: string | null
          modified_date: string | null
          more_pm: string | null
          more_pm_id: string | null
          n_financial_year: string | null
          n_financial_year_id: string | null
          n_pitching_financial_year: string | null
          n_project_type: string | null
          n_service_type: string | null
          n_service_type_id: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          os_schedule_group: string | null
          other_pm: string | null
          other_pm_id: string | null
          payment_status: string | null
          pitching: string | null
          pitching_id: string | null
          project_code: string | null
          project_name: string | null
          project_size: string | null
          project_type_search: string | null
          quote_project_type_id: string | null
          r_building: string | null
          r_building_id: string | null
          r_nos_district_id: string | null
          real_building_name: string | null
          real_cost_centre: string | null
          real_creator_name: string | null
          real_customer_display_name: string | null
          real_customer_name: string | null
          real_district_name: string | null
          required_check_date: string | null
          service_type_search: string | null
          signed_date: string | null
          site_address: string | null
          size: string | null
          slug: string | null
          sort_financial_year: string | null
          start_date: string | null
          status: string | null
          supplier: string | null
          supplier_id: string | null
          working_folder: string | null
          x_f_form_s1: string | null
          x_f_form_s2: string | null
          x_f_form_s3: string | null
          x_name_district_building_site_search: string | null
          x_real_other_name: string | null
          x_visible: boolean | null
          xf_site_work_insurance: string | null
        }
        Insert: {
          actual_size?: string | null
          asana_link?: string | null
          b2b_b2c?: string | null
          bubble_id?: string | null
          cost_centre?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          defect_done_date?: string | null
          description?: string | null
          e_outstanding_date?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          estimated_profit?: number | null
          external_customer_name?: string | null
          external_project_name?: string | null
          fixed_search?: string | null
          handover_date?: string | null
          height_to_bs?: string | null
          height_to_fc?: string | null
          height_to_tc?: string | null
          id?: string
          income_below_estimated_reason?: string | null
          main_air_supplier?: string | null
          main_air_supplier_id?: string | null
          main_contractor?: string | null
          main_contractor_id?: string | null
          main_designer?: string | null
          main_designer_id?: string | null
          main_divide?: string | null
          main_network_supplier?: string | null
          main_network_supplier_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_pitching_financial_year?: string | null
          n_project_type?: string | null
          n_service_type?: string | null
          n_service_type_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_schedule_group?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          payment_status?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project_code?: string | null
          project_name?: string | null
          project_size?: string | null
          project_type_search?: string | null
          quote_project_type_id?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_nos_district_id?: string | null
          real_building_name?: string | null
          real_cost_centre?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          real_district_name?: string | null
          required_check_date?: string | null
          service_type_search?: string | null
          signed_date?: string | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          sort_financial_year?: string | null
          start_date?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          working_folder?: string | null
          x_f_form_s1?: string | null
          x_f_form_s2?: string | null
          x_f_form_s3?: string | null
          x_name_district_building_site_search?: string | null
          x_real_other_name?: string | null
          x_visible?: boolean | null
          xf_site_work_insurance?: string | null
        }
        Update: {
          actual_size?: string | null
          asana_link?: string | null
          b2b_b2c?: string | null
          bubble_id?: string | null
          cost_centre?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          defect_done_date?: string | null
          description?: string | null
          e_outstanding_date?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          estimated_profit?: number | null
          external_customer_name?: string | null
          external_project_name?: string | null
          fixed_search?: string | null
          handover_date?: string | null
          height_to_bs?: string | null
          height_to_fc?: string | null
          height_to_tc?: string | null
          id?: string
          income_below_estimated_reason?: string | null
          main_air_supplier?: string | null
          main_air_supplier_id?: string | null
          main_contractor?: string | null
          main_contractor_id?: string | null
          main_designer?: string | null
          main_designer_id?: string | null
          main_divide?: string | null
          main_network_supplier?: string | null
          main_network_supplier_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_pitching_financial_year?: string | null
          n_project_type?: string | null
          n_service_type?: string | null
          n_service_type_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_schedule_group?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          payment_status?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project_code?: string | null
          project_name?: string | null
          project_size?: string | null
          project_type_search?: string | null
          quote_project_type_id?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_nos_district_id?: string | null
          real_building_name?: string | null
          real_cost_centre?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          real_district_name?: string | null
          required_check_date?: string | null
          service_type_search?: string | null
          signed_date?: string | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          sort_financial_year?: string | null
          start_date?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          working_folder?: string | null
          x_f_form_s1?: string | null
          x_f_form_s2?: string | null
          x_f_form_s3?: string | null
          x_name_district_building_site_search?: string | null
          x_real_other_name?: string | null
          x_visible?: boolean | null
          xf_site_work_insurance?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bwa_projects_quote_project_type_id_fkey"
            columns: ["quote_project_type_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_cost_centre_id"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_main_air_supplier_id"
            columns: ["main_air_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_main_contractor_id"
            columns: ["main_contractor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_main_designer_id"
            columns: ["main_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_main_network_supplier_id"
            columns: ["main_network_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_main_pm_id"
            columns: ["main_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_more_pm_id"
            columns: ["more_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_n_financial_year_id"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_n_service_type_id"
            columns: ["n_service_type_id"]
            isOneToOne: false
            referencedRelation: "service_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_other_pm_id"
            columns: ["other_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_r_building_id"
            columns: ["r_building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_r_nos_district_id"
            columns: ["r_nos_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwa_projects_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_major_quotes: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          is_big_project: boolean | null
          is_pp: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_big_project?: boolean | null
          is_pp?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_big_project?: boolean | null
          is_pp?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bwf_major_quotes_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_orders: {
        Row: {
          bubble_id: string | null
          bwf_pitching: string | null
          bwf_pitching_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          complete_installation_date: string | null
          complete_installation_date_est: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          defect_factory: string | null
          defect_factory_id: string | null
          defect_fixed_date: string | null
          defect_member: string | null
          defect_member_id: string | null
          defect_notes: string | null
          defect_supplier: string | null
          defect_supplier_id: string | null
          deliver_to_factory: string | null
          deliver_to_factory_id: string | null
          factory: string | null
          factory_id: string | null
          id: string
          installation_team: string | null
          installation_team_id: string | null
          installer_needed: string | null
          modified_date: string | null
          n_defect_cause: string | null
          n_defect_cause_id: string | null
          o_defect_source: string | null
          o_defect_status: string | null
          o_delivery_target: string | null
          o_order_status: string | null
          product: string | null
          product_id: string | null
          production_finish_date: string | null
          production_finish_date_est: string | null
          production_start_date: string | null
          quantity: number | null
          remarks: string | null
          site_arrival_date: string | null
          site_arrival_date_est: string | null
          slug: string | null
          warehouse: string | null
          warehouse_arrival_date: string | null
          warehouse_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          complete_installation_date?: string | null
          complete_installation_date_est?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          defect_factory?: string | null
          defect_factory_id?: string | null
          defect_fixed_date?: string | null
          defect_member?: string | null
          defect_member_id?: string | null
          defect_notes?: string | null
          defect_supplier?: string | null
          defect_supplier_id?: string | null
          deliver_to_factory?: string | null
          deliver_to_factory_id?: string | null
          factory?: string | null
          factory_id?: string | null
          id?: string
          installation_team?: string | null
          installation_team_id?: string | null
          installer_needed?: string | null
          modified_date?: string | null
          n_defect_cause?: string | null
          n_defect_cause_id?: string | null
          o_defect_source?: string | null
          o_defect_status?: string | null
          o_delivery_target?: string | null
          o_order_status?: string | null
          product?: string | null
          product_id?: string | null
          production_finish_date?: string | null
          production_finish_date_est?: string | null
          production_start_date?: string | null
          quantity?: number | null
          remarks?: string | null
          site_arrival_date?: string | null
          site_arrival_date_est?: string | null
          slug?: string | null
          warehouse?: string | null
          warehouse_arrival_date?: string | null
          warehouse_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          complete_installation_date?: string | null
          complete_installation_date_est?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          defect_factory?: string | null
          defect_factory_id?: string | null
          defect_fixed_date?: string | null
          defect_member?: string | null
          defect_member_id?: string | null
          defect_notes?: string | null
          defect_supplier?: string | null
          defect_supplier_id?: string | null
          deliver_to_factory?: string | null
          deliver_to_factory_id?: string | null
          factory?: string | null
          factory_id?: string | null
          id?: string
          installation_team?: string | null
          installation_team_id?: string | null
          installer_needed?: string | null
          modified_date?: string | null
          n_defect_cause?: string | null
          n_defect_cause_id?: string | null
          o_defect_source?: string | null
          o_defect_status?: string | null
          o_delivery_target?: string | null
          o_order_status?: string | null
          product?: string | null
          product_id?: string | null
          production_finish_date?: string | null
          production_finish_date_est?: string | null
          production_start_date?: string | null
          quantity?: number | null
          remarks?: string | null
          site_arrival_date?: string | null
          site_arrival_date_est?: string | null
          slug?: string | null
          warehouse?: string | null
          warehouse_arrival_date?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bwf_orders_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_defect_factory_id"
            columns: ["defect_factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_defect_member_id"
            columns: ["defect_member_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_defect_supplier_id"
            columns: ["defect_supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_deliver_to_factory_id"
            columns: ["deliver_to_factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_factory_id"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_installation_team_id"
            columns: ["installation_team_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_n_defect_cause_id"
            columns: ["n_defect_cause_id"]
            isOneToOne: false
            referencedRelation: "nos_defect_causes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_product_id"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "bwf_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_orders_warehouse_id"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_pitching_bwf_service_types: {
        Row: {
          id: string
          pitching_id: string | null
          service_type_id: string | null
        }
        Insert: {
          id?: string
          pitching_id?: string | null
          service_type_id?: string | null
        }
        Update: {
          id?: string
          pitching_id?: string | null
          service_type_id?: string | null
        }
        Relationships: []
      }
      bwf_pitching_major_quotes: {
        Row: {
          id: string
          major_quote_id: string | null
          pitching_id: string | null
        }
        Insert: {
          id?: string
          major_quote_id?: string | null
          pitching_id?: string | null
        }
        Update: {
          id?: string
          major_quote_id?: string | null
          pitching_id?: string | null
        }
        Relationships: []
      }
      bwf_pitching_service_items: {
        Row: {
          id: string
          pitching_id: string | null
          service_item_id: string | null
        }
        Insert: {
          id?: string
          pitching_id?: string | null
          service_item_id?: string | null
        }
        Update: {
          id?: string
          pitching_id?: string | null
          service_item_id?: string | null
        }
        Relationships: []
      }
      bwf_pitchings: {
        Row: {
          asana_link: string | null
          bubble_id: string | null
          case_close_reason: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          district: string | null
          district_id: string | null
          enquiry_date: string | null
          estimated_expense: number | null
          estimated_income: number | null
          id: string
          main_designer: string | null
          main_designer_id: string | null
          main_pm: string | null
          main_pm_id: string | null
          modified_date: string | null
          more_pms: string | null
          more_pms_id: string | null
          n_bwf_service_types: string | null
          n_bwf_service_types_id: string | null
          n_customer_type: string | null
          n_customer_type_id: string | null
          n_financial_year: string | null
          n_financial_year_id: string | null
          n_major_quotes: string | null
          n_major_quotes_id: string | null
          n_service_items: string | null
          n_service_items_id: string | null
          n_source: string | null
          n_source_id: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          os_size: string | null
          other_pms: string | null
          other_pms_id: string | null
          pitching_code: string | null
          pitching_name: string | null
          pitching_stages: string | null
          quote_content: string | null
          r_building: string | null
          r_building_id: string | null
          r_district: string | null
          r_district_id: string | null
          real_building_name: string | null
          real_creator_name: string | null
          real_customer_display_name: string | null
          real_customer_name: string | null
          send_email: boolean | null
          site_address: string | null
          size: string | null
          slug: string | null
          working_folder: string | null
        }
        Insert: {
          asana_link?: string | null
          bubble_id?: string | null
          case_close_reason?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          district?: string | null
          district_id?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          id?: string
          main_designer?: string | null
          main_designer_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pms?: string | null
          more_pms_id?: string | null
          n_bwf_service_types?: string | null
          n_bwf_service_types_id?: string | null
          n_customer_type?: string | null
          n_customer_type_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_major_quotes?: string | null
          n_major_quotes_id?: string | null
          n_service_items?: string | null
          n_service_items_id?: string | null
          n_source?: string | null
          n_source_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_size?: string | null
          other_pms?: string | null
          other_pms_id?: string | null
          pitching_code?: string | null
          pitching_name?: string | null
          pitching_stages?: string | null
          quote_content?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_district?: string | null
          r_district_id?: string | null
          real_building_name?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          send_email?: boolean | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          working_folder?: string | null
        }
        Update: {
          asana_link?: string | null
          bubble_id?: string | null
          case_close_reason?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          district?: string | null
          district_id?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          id?: string
          main_designer?: string | null
          main_designer_id?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pms?: string | null
          more_pms_id?: string | null
          n_bwf_service_types?: string | null
          n_bwf_service_types_id?: string | null
          n_customer_type?: string | null
          n_customer_type_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_major_quotes?: string | null
          n_major_quotes_id?: string | null
          n_service_items?: string | null
          n_service_items_id?: string | null
          n_source?: string | null
          n_source_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          os_size?: string | null
          other_pms?: string | null
          other_pms_id?: string | null
          pitching_code?: string | null
          pitching_name?: string | null
          pitching_stages?: string | null
          quote_content?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_district?: string | null
          r_district_id?: string | null
          real_building_name?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          send_email?: boolean | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          working_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bwf_pitchings_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_district_id"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_main_designer_id"
            columns: ["main_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_main_pm_id"
            columns: ["main_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_more_pms_id"
            columns: ["more_pms_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_bwf_service_types_id"
            columns: ["n_bwf_service_types_id"]
            isOneToOne: false
            referencedRelation: "nos_service_type_2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_customer_type_id"
            columns: ["n_customer_type_id"]
            isOneToOne: false
            referencedRelation: "client_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_financial_year_id"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_major_quotes_id"
            columns: ["n_major_quotes_id"]
            isOneToOne: false
            referencedRelation: "bwf_major_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_service_items_id"
            columns: ["n_service_items_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_source_id"
            columns: ["n_source_id"]
            isOneToOne: false
            referencedRelation: "source_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_other_pms_id"
            columns: ["other_pms_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_r_building_id"
            columns: ["r_building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_pitchings_r_district_id"
            columns: ["r_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_product_master: {
        Row: {
          category: string | null
          color: string | null
          cost_price: number | null
          created_at: string | null
          delivery_days: number | null
          delivery_term_id: string | null
          delivery_term_name: string | null
          description: string | null
          dimension_h_mm: number | null
          dimension_l_mm: number | null
          dimension_w_mm: number | null
          factory_highlight: Json | null
          factory_id: string | null
          factory_name: string | null
          id: string
          image_url: string | null
          images: Json | null
          lifestyle_image_url: string | null
          material: string | null
          production_lead_time: number | null
          remarks: string | null
          sale_price: number | null
          shipping_days: number | null
          shipping_fee: number | null
          shopify_compare_at_price: number | null
          shopify_id: string | null
          shopify_price: number | null
          title: string | null
          total_lead_time: number | null
          updated_at: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          delivery_days?: number | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factory_highlight?: Json | null
          factory_id?: string | null
          factory_name?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          lifestyle_image_url?: string | null
          material?: string | null
          production_lead_time?: number | null
          remarks?: string | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_compare_at_price?: number | null
          shopify_id?: string | null
          shopify_price?: number | null
          title?: string | null
          total_lead_time?: number | null
          updated_at?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          cost_price?: number | null
          created_at?: string | null
          delivery_days?: number | null
          delivery_term_id?: string | null
          delivery_term_name?: string | null
          description?: string | null
          dimension_h_mm?: number | null
          dimension_l_mm?: number | null
          dimension_w_mm?: number | null
          factory_highlight?: Json | null
          factory_id?: string | null
          factory_name?: string | null
          id?: string
          image_url?: string | null
          images?: Json | null
          lifestyle_image_url?: string | null
          material?: string | null
          production_lead_time?: number | null
          remarks?: string | null
          sale_price?: number | null
          shipping_days?: number | null
          shipping_fee?: number | null
          shopify_compare_at_price?: number | null
          shopify_id?: string | null
          shopify_price?: number | null
          title?: string | null
          total_lead_time?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      bwf_product_product_types: {
        Row: {
          id: string
          product_id: string
          product_type_id: string
        }
        Insert: {
          id?: string
          product_id: string
          product_type_id: string
        }
        Update: {
          id?: string
          product_id?: string
          product_type_id?: string
        }
        Relationships: []
      }
      bwf_products: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          product_types: string | null
          product_types_id: string | null
          slug: string | null
          temp_quantity: number | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          product_types?: string | null
          product_types_id?: string | null
          slug?: string | null
          temp_quantity?: number | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          product_types?: string | null
          product_types_id?: string | null
          slug?: string | null
          temp_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bwf_products_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_products_product_types_id"
            columns: ["product_types_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_project_bwf_service_types: {
        Row: {
          id: string
          project_id: string | null
          service_type_id: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          service_type_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          service_type_id?: string | null
        }
        Relationships: []
      }
      bwf_project_factories: {
        Row: {
          factory_id: string
          id: string
          project_id: string
        }
        Insert: {
          factory_id: string
          id?: string
          project_id: string
        }
        Update: {
          factory_id?: string
          id?: string
          project_id?: string
        }
        Relationships: []
      }
      bwf_project_major_quotes: {
        Row: {
          id: string
          major_quote_id: string | null
          project_id: string | null
        }
        Insert: {
          id?: string
          major_quote_id?: string | null
          project_id?: string | null
        }
        Update: {
          id?: string
          major_quote_id?: string | null
          project_id?: string | null
        }
        Relationships: []
      }
      bwf_project_service_items: {
        Row: {
          id: string
          project_id: string | null
          service_item_id: string | null
        }
        Insert: {
          id?: string
          project_id?: string | null
          service_item_id?: string | null
        }
        Update: {
          id?: string
          project_id?: string | null
          service_item_id?: string | null
        }
        Relationships: []
      }
      bwf_project_suppliers: {
        Row: {
          id: string
          project_id: string
          supplier_id: string
        }
        Insert: {
          id?: string
          project_id: string
          supplier_id: string
        }
        Update: {
          id?: string
          project_id?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bwf_project_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bwf_projects: {
        Row: {
          asana_link: string | null
          bubble_id: string | null
          bwf_pitching: string | null
          bwf_pitching_id: string | null
          completion_photos: string | null
          cost_center: string | null
          cost_center_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          district: string | null
          district_id: string | null
          e_outstanding_date: string | null
          enquiry_date: string | null
          estimated_expense: number | null
          estimated_income: number | null
          estimated_profit: number | null
          factories: string | null
          factories_id: string | null
          fixed_search: string | null
          handover_date: string | null
          id: string
          income_below_estimated_reason: string | null
          main_contractor: string | null
          main_contractor_id: string | null
          main_designer: string | null
          main_designer_id: string | null
          main_divide: string | null
          main_pm: string | null
          main_pm_id: string | null
          modified_date: string | null
          more_pm: string | null
          more_pm_id: string | null
          n_bwf_service_types: string | null
          n_bwf_service_types_id: string | null
          n_customer_type: string | null
          n_customer_type_id: string | null
          n_financial_year: string | null
          n_financial_year_id: string | null
          n_major_quotes: string | null
          n_major_quotes_id: string | null
          n_pitching_financial_year: string | null
          n_service_items: string | null
          n_service_items_id: string | null
          n_source: string | null
          n_source_id: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          name_district_building_site_search: string | null
          os_project_defect: string | null
          os_size: string | null
          other_pm: string | null
          other_pm_id: string | null
          p2_code: string | null
          payment_status: string | null
          project_approval: string | null
          project_code: string | null
          project_content: string | null
          project_name: string | null
          project_type_search: string | null
          r_building: string | null
          r_building_id: string | null
          r_district: string | null
          r_district_id: string | null
          real_building_name: string | null
          real_cost_centre: string | null
          real_creator_name: string | null
          real_customer_display_name: string | null
          real_customer_name: string | null
          real_other_name: string | null
          required_check_date: string | null
          service_type_search: string | null
          signed_date: string | null
          site_address: string | null
          size: string | null
          slug: string | null
          sort_financial_year: string | null
          start_date: string | null
          status: string | null
          supplier: string | null
          supplier_id: string | null
          visible: boolean | null
          working_folder: string | null
        }
        Insert: {
          asana_link?: string | null
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          completion_photos?: string | null
          cost_center?: string | null
          cost_center_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          district?: string | null
          district_id?: string | null
          e_outstanding_date?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          estimated_profit?: number | null
          factories?: string | null
          factories_id?: string | null
          fixed_search?: string | null
          handover_date?: string | null
          id?: string
          income_below_estimated_reason?: string | null
          main_contractor?: string | null
          main_contractor_id?: string | null
          main_designer?: string | null
          main_designer_id?: string | null
          main_divide?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_bwf_service_types?: string | null
          n_bwf_service_types_id?: string | null
          n_customer_type?: string | null
          n_customer_type_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_major_quotes?: string | null
          n_major_quotes_id?: string | null
          n_pitching_financial_year?: string | null
          n_service_items?: string | null
          n_service_items_id?: string | null
          n_source?: string | null
          n_source_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          name_district_building_site_search?: string | null
          os_project_defect?: string | null
          os_size?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          p2_code?: string | null
          payment_status?: string | null
          project_approval?: string | null
          project_code?: string | null
          project_content?: string | null
          project_name?: string | null
          project_type_search?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_district?: string | null
          r_district_id?: string | null
          real_building_name?: string | null
          real_cost_centre?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          real_other_name?: string | null
          required_check_date?: string | null
          service_type_search?: string | null
          signed_date?: string | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          sort_financial_year?: string | null
          start_date?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          visible?: boolean | null
          working_folder?: string | null
        }
        Update: {
          asana_link?: string | null
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          completion_photos?: string | null
          cost_center?: string | null
          cost_center_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          district?: string | null
          district_id?: string | null
          e_outstanding_date?: string | null
          enquiry_date?: string | null
          estimated_expense?: number | null
          estimated_income?: number | null
          estimated_profit?: number | null
          factories?: string | null
          factories_id?: string | null
          fixed_search?: string | null
          handover_date?: string | null
          id?: string
          income_below_estimated_reason?: string | null
          main_contractor?: string | null
          main_contractor_id?: string | null
          main_designer?: string | null
          main_designer_id?: string | null
          main_divide?: string | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          more_pm?: string | null
          more_pm_id?: string | null
          n_bwf_service_types?: string | null
          n_bwf_service_types_id?: string | null
          n_customer_type?: string | null
          n_customer_type_id?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_major_quotes?: string | null
          n_major_quotes_id?: string | null
          n_pitching_financial_year?: string | null
          n_service_items?: string | null
          n_service_items_id?: string | null
          n_source?: string | null
          n_source_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          name_district_building_site_search?: string | null
          os_project_defect?: string | null
          os_size?: string | null
          other_pm?: string | null
          other_pm_id?: string | null
          p2_code?: string | null
          payment_status?: string | null
          project_approval?: string | null
          project_code?: string | null
          project_content?: string | null
          project_name?: string | null
          project_type_search?: string | null
          r_building?: string | null
          r_building_id?: string | null
          r_district?: string | null
          r_district_id?: string | null
          real_building_name?: string | null
          real_cost_centre?: string | null
          real_creator_name?: string | null
          real_customer_display_name?: string | null
          real_customer_name?: string | null
          real_other_name?: string | null
          required_check_date?: string | null
          service_type_search?: string | null
          signed_date?: string | null
          site_address?: string | null
          size?: string | null
          slug?: string | null
          sort_financial_year?: string | null
          start_date?: string | null
          status?: string | null
          supplier?: string | null
          supplier_id?: string | null
          visible?: boolean | null
          working_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_bwf_projects_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_cost_center_id"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_district_id"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_factories_id"
            columns: ["factories_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_main_contractor_id"
            columns: ["main_contractor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_main_designer_id"
            columns: ["main_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_main_pm_id"
            columns: ["main_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_more_pm_id"
            columns: ["more_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_bwf_service_types_id"
            columns: ["n_bwf_service_types_id"]
            isOneToOne: false
            referencedRelation: "nos_service_type_2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_customer_type_id"
            columns: ["n_customer_type_id"]
            isOneToOne: false
            referencedRelation: "client_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_financial_year_id"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_major_quotes_id"
            columns: ["n_major_quotes_id"]
            isOneToOne: false
            referencedRelation: "bwf_major_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_service_items_id"
            columns: ["n_service_items_id"]
            isOneToOne: false
            referencedRelation: "service_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_source_id"
            columns: ["n_source_id"]
            isOneToOne: false
            referencedRelation: "source_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_other_pm_id"
            columns: ["other_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_r_building_id"
            columns: ["r_building_id"]
            isOneToOne: false
            referencedRelation: "buildings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_r_district_id"
            columns: ["r_district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_bwf_projects_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      client_types: {
        Row: {
          bubble_id: string | null
          code: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_client_types_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centres: {
        Row: {
          bank_notes: string | null
          bu_code: string | null
          bubble_id: string | null
          business_logo: string | null
          chinese_display: string | null
          company_chop: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          expense_control_enabled: boolean
          id: string
          modified_date: string | null
          project_code_initial: string | null
          slug: string | null
          status: string | null
        }
        Insert: {
          bank_notes?: string | null
          bu_code?: string | null
          bubble_id?: string | null
          business_logo?: string | null
          chinese_display?: string | null
          company_chop?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          expense_control_enabled?: boolean
          id?: string
          modified_date?: string | null
          project_code_initial?: string | null
          slug?: string | null
          status?: string | null
        }
        Update: {
          bank_notes?: string | null
          bu_code?: string | null
          bubble_id?: string | null
          business_logo?: string | null
          chinese_display?: string | null
          company_chop?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          expense_control_enabled?: boolean
          id?: string
          modified_date?: string | null
          project_code_initial?: string | null
          slug?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cost_centres_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_event_detail_staff: {
        Row: {
          cr_event_detail_id: string | null
          id: string
          staff_id: string | null
        }
        Insert: {
          cr_event_detail_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Update: {
          cr_event_detail_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Relationships: []
      }
      cr_event_details: {
        Row: {
          bubble_id: string | null
          consignee: string | null
          consignee_address: string | null
          consignee_phone: string | null
          cost_per_item: number | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          cust_gift_item: string | null
          cust_gift_item_id: string | null
          customer: string | null
          customer_id: string | null
          delivery_date: string | null
          delivery_method: string | null
          delivery_method_id: string | null
          event: string | null
          event_id: string | null
          handler: string | null
          handler_id: string | null
          id: string
          item_quantity: number | null
          modified_date: string | null
          related_staff: string | null
          related_staff_id: string | null
          remarks: string | null
          slug: string | null
          status: string | null
          total_cost: number | null
        }
        Insert: {
          bubble_id?: string | null
          consignee?: string | null
          consignee_address?: string | null
          consignee_phone?: string | null
          cost_per_item?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          cust_gift_item?: string | null
          cust_gift_item_id?: string | null
          customer?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          delivery_method?: string | null
          delivery_method_id?: string | null
          event?: string | null
          event_id?: string | null
          handler?: string | null
          handler_id?: string | null
          id?: string
          item_quantity?: number | null
          modified_date?: string | null
          related_staff?: string | null
          related_staff_id?: string | null
          remarks?: string | null
          slug?: string | null
          status?: string | null
          total_cost?: number | null
        }
        Update: {
          bubble_id?: string | null
          consignee?: string | null
          consignee_address?: string | null
          consignee_phone?: string | null
          cost_per_item?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          cust_gift_item?: string | null
          cust_gift_item_id?: string | null
          customer?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          delivery_method?: string | null
          delivery_method_id?: string | null
          event?: string | null
          event_id?: string | null
          handler?: string | null
          handler_id?: string | null
          id?: string
          item_quantity?: number | null
          modified_date?: string | null
          related_staff?: string | null
          related_staff_id?: string | null
          remarks?: string | null
          slug?: string | null
          status?: string | null
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cr_event_details_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_cust_gift_item_id"
            columns: ["cust_gift_item_id"]
            isOneToOne: false
            referencedRelation: "cr_gift_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_delivery_method_id"
            columns: ["delivery_method_id"]
            isOneToOne: false
            referencedRelation: "nos_cr_delivery_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_event_id"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "customer_relations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_handler_id"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_cr_event_details_related_staff_id"
            columns: ["related_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      cr_gift_items: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          event_condition: string | null
          id: string
          item_cost: number | null
          item_image: string | null
          item_name: string | null
          item_remarks: string | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          event_condition?: string | null
          id?: string
          item_cost?: number | null
          item_image?: string | null
          item_name?: string | null
          item_remarks?: string | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          event_condition?: string | null
          id?: string
          item_cost?: number | null
          item_image?: string | null
          item_name?: string | null
          item_remarks?: string | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_cr_gift_items_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_comments: {
        Row: {
          bubble_id: string | null
          comment: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          evaluator: string | null
          evaluator_id: string | null
          id: string
          modified_date: string | null
          pitching: string | null
          pitching_id: string | null
          project: string | null
          project_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_comments_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_comments_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_comments_evaluator_id"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_comments_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_comments_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_cr_events: {
        Row: {
          cr_event_id: string | null
          customer_id: string | null
          id: string
        }
        Insert: {
          cr_event_id?: string | null
          customer_id?: string | null
          id?: string
        }
        Update: {
          cr_event_id?: string | null
          customer_id?: string | null
          id?: string
        }
        Relationships: []
      }
      customer_relations: {
        Row: {
          bubble_id: string | null
          cr_event_detail: string | null
          cr_event_detail_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          event_date: string | null
          event_name: string | null
          event_remarks: string | null
          event_status: string | null
          event_theme: string | null
          event_theme_id: string | null
          event_type: string | null
          event_type_id: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          cr_event_detail?: string | null
          cr_event_detail_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          event_date?: string | null
          event_name?: string | null
          event_remarks?: string | null
          event_status?: string | null
          event_theme?: string | null
          event_theme_id?: string | null
          event_type?: string | null
          event_type_id?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          cr_event_detail?: string | null
          cr_event_detail_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          event_date?: string | null
          event_name?: string | null
          event_remarks?: string | null
          event_status?: string | null
          event_theme?: string | null
          event_theme_id?: string | null
          event_type?: string | null
          event_type_id?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_relations_cr_event_detail_id"
            columns: ["cr_event_detail_id"]
            isOneToOne: false
            referencedRelation: "cr_event_details"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_relations_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_relations_event_theme_id"
            columns: ["event_theme_id"]
            isOneToOne: false
            referencedRelation: "nos_cr_event_themes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_relations_event_type_id"
            columns: ["event_type_id"]
            isOneToOne: false
            referencedRelation: "nos_cr_event_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          collection_uuid: string | null
          customer_id: string | null
          customer_uuid: string | null
          id: string
          tag_id: string | null
          tag_uuid: string | null
        }
        Insert: {
          collection_uuid?: string | null
          customer_id?: string | null
          customer_uuid?: string | null
          id?: string
          tag_id?: string | null
          tag_uuid?: string | null
        }
        Update: {
          collection_uuid?: string | null
          customer_id?: string | null
          customer_uuid?: string | null
          id?: string
          tag_id?: string | null
          tag_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customer_tags_collection_uuid"
            columns: ["collection_uuid"]
            isOneToOne: false
            referencedRelation: "nos_customer_tags_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_tags_customer_uuid"
            columns: ["customer_uuid"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customer_tags_tag_uuid"
            columns: ["tag_uuid"]
            isOneToOne: false
            referencedRelation: "nos_customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_document_types: {
        Row: {
          code_number_required: boolean
          created_date: string
          enable_expiry_date: boolean
          id: string
          modified_date: string
          sort_order: number
          type: string
          type_key: string
        }
        Insert: {
          code_number_required?: boolean
          created_date?: string
          enable_expiry_date?: boolean
          id?: string
          modified_date?: string
          sort_order?: number
          type: string
          type_key: string
        }
        Update: {
          code_number_required?: boolean
          created_date?: string
          enable_expiry_date?: boolean
          id?: string
          modified_date?: string
          sort_order?: number
          type?: string
          type_key?: string
        }
        Relationships: []
      }
      customer_documents: {
        Row: {
          code_number: string | null
          created_by_id: string | null
          created_date: string
          customer_id: string
          document_date: string | null
          expiry_date: string | null
          file: string | null
          file_name: string | null
          id: string
          legacy_file: string | null
          migration_status: string
          modified_date: string
          remarks: string | null
          source_project_document_id: string | null
          type_id: string
        }
        Insert: {
          code_number?: string | null
          created_by_id?: string | null
          created_date?: string
          customer_id: string
          document_date?: string | null
          expiry_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          legacy_file?: string | null
          migration_status?: string
          modified_date?: string
          remarks?: string | null
          source_project_document_id?: string | null
          type_id: string
        }
        Update: {
          code_number?: string | null
          created_by_id?: string | null
          created_date?: string
          customer_id?: string
          document_date?: string | null
          expiry_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          legacy_file?: string | null
          migration_status?: string
          modified_date?: string
          remarks?: string | null
          source_project_document_id?: string | null
          type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "customer_document_types"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          asana: string | null
          brand_name_cn: string | null
          brand_name_en: string | null
          branding_icon: string | null
          bubble_id: string | null
          bwa_income: number | null
          bwa_pitching_number: number | null
          bwa_profit: number | null
          bwa_project_number: number | null
          bwa_receivable: number | null
          bwf_income: number | null
          bwf_pitching_no: number | null
          bwf_profit: number | null
          bwf_project_number: number | null
          bwf_receivable: number | null
          company_name: string | null
          cr_event: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer_name: string | null
          display_name: string | null
          email: string | null
          enquiry_create_date: string | null
          id: string
          member_created_by: string | null
          member_created_by_id: string | null
          modified_date: string | null
          phone_display: string | null
          phone_number_a: string | null
          phone_number_b: string | null
          real_created_by_name: string | null
          remark: string | null
          slug: string | null
          status: string
          status_filter_value: string | null
          tags: string | null
          view_system: string | null
        }
        Insert: {
          address?: string | null
          asana?: string | null
          brand_name_cn?: string | null
          brand_name_en?: string | null
          branding_icon?: string | null
          bubble_id?: string | null
          bwa_income?: number | null
          bwa_pitching_number?: number | null
          bwa_profit?: number | null
          bwa_project_number?: number | null
          bwa_receivable?: number | null
          bwf_income?: number | null
          bwf_pitching_no?: number | null
          bwf_profit?: number | null
          bwf_project_number?: number | null
          bwf_receivable?: number | null
          company_name?: string | null
          cr_event?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_name?: string | null
          display_name?: string | null
          email?: string | null
          enquiry_create_date?: string | null
          id?: string
          member_created_by?: string | null
          member_created_by_id?: string | null
          modified_date?: string | null
          phone_display?: string | null
          phone_number_a?: string | null
          phone_number_b?: string | null
          real_created_by_name?: string | null
          remark?: string | null
          slug?: string | null
          status?: string
          status_filter_value?: string | null
          tags?: string | null
          view_system?: string | null
        }
        Update: {
          address?: string | null
          asana?: string | null
          brand_name_cn?: string | null
          brand_name_en?: string | null
          branding_icon?: string | null
          bubble_id?: string | null
          bwa_income?: number | null
          bwa_pitching_number?: number | null
          bwa_profit?: number | null
          bwa_project_number?: number | null
          bwa_receivable?: number | null
          bwf_income?: number | null
          bwf_pitching_no?: number | null
          bwf_profit?: number | null
          bwf_project_number?: number | null
          bwf_receivable?: number | null
          company_name?: string | null
          cr_event?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_name?: string | null
          display_name?: string | null
          email?: string | null
          enquiry_create_date?: string | null
          id?: string
          member_created_by?: string | null
          member_created_by_id?: string | null
          modified_date?: string | null
          phone_display?: string | null
          phone_number_a?: string | null
          phone_number_b?: string | null
          real_created_by_name?: string | null
          remark?: string | null
          slug?: string | null
          status?: string
          status_filter_value?: string | null
          tags?: string | null
          view_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_customers_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_customers_member_created_by_id"
            columns: ["member_created_by_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_task_logs: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          module: string | null
          staff_name: string | null
          status: string
          task_date: string
          title: string
          updated_at: string | null
        }
        Insert: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string | null
          staff_name?: string | null
          status?: string
          task_date?: string
          title: string
          updated_at?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          module?: string | null
          staff_name?: string | null
          status?: string
          task_date?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dashboard_sentences: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          is_bwa: boolean | null
          is_bwf: boolean | null
          modified_date: string | null
          slug: string | null
          text: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          is_bwa?: boolean | null
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
          text?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          is_bwa?: boolean | null
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_dashboard_sentences_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      default_quote_details: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          default_quote: string | null
          default_quote_id: string | null
          default_section: string | null
          default_section_id: string | null
          id: string
          modified_date: string | null
          order: number | null
          quantity: number | null
          r_item: string | null
          r_item_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          default_quote?: string | null
          default_quote_id?: string | null
          default_section?: string | null
          default_section_id?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quantity?: number | null
          r_item?: string | null
          r_item_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          default_quote?: string | null
          default_quote_id?: string | null
          default_section?: string | null
          default_section_id?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quantity?: number | null
          r_item?: string | null
          r_item_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_default_quote_details_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_details_default_quote_id"
            columns: ["default_quote_id"]
            isOneToOne: false
            referencedRelation: "default_quote_mains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_details_default_section_id"
            columns: ["default_section_id"]
            isOneToOne: false
            referencedRelation: "default_quote_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_details_r_item_id"
            columns: ["r_item_id"]
            isOneToOne: false
            referencedRelation: "nos_items"
            referencedColumns: ["id"]
          },
        ]
      }
      default_quote_mains: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          name: string | null
          quote_image: string | null
          quote_type: string | null
          real_creator: string | null
          real_creator_id: string | null
          slug: string | null
          terms_and_conditions: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          quote_image?: string | null
          quote_type?: string | null
          real_creator?: string | null
          real_creator_id?: string | null
          slug?: string | null
          terms_and_conditions?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          quote_image?: string | null
          quote_type?: string | null
          real_creator?: string | null
          real_creator_id?: string | null
          slug?: string | null
          terms_and_conditions?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_default_quote_mains_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_mains_real_creator_id"
            columns: ["real_creator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      default_quote_sections: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          default_quote: string | null
          default_quote_id: string | null
          id: string
          modified_date: string | null
          order: number | null
          r_section: string | null
          r_section_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          default_quote?: string | null
          default_quote_id?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          r_section?: string | null
          r_section_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          default_quote?: string | null
          default_quote_id?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          r_section?: string | null
          r_section_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_default_quote_sections_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_sections_default_quote_id"
            columns: ["default_quote_id"]
            isOneToOne: false
            referencedRelation: "default_quote_mains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_default_quote_sections_r_section_id"
            columns: ["r_section_id"]
            isOneToOne: false
            referencedRelation: "nos_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      design_jobs: {
        Row: {
          budget_hours: number
          created_at: string
          design_stage: string
          display_name: string
          due_date: string
          id: string
          job_type: string
          nos_task_id: string
          pitching_id: string
          progress_pct: number
          project_id: string | null
          source: string
          staff_id: string
          updated_at: string
        }
        Insert: {
          budget_hours: number
          created_at?: string
          design_stage: string
          display_name?: string
          due_date: string
          id?: string
          job_type: string
          nos_task_id: string
          pitching_id: string
          progress_pct?: number
          project_id?: string | null
          source: string
          staff_id: string
          updated_at?: string
        }
        Update: {
          budget_hours?: number
          created_at?: string
          design_stage?: string
          display_name?: string
          due_date?: string
          id?: string
          job_type?: string
          nos_task_id?: string
          pitching_id?: string
          progress_pct?: number
          project_id?: string | null
          source?: string
          staff_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "design_jobs_nos_task_id_fkey"
            columns: ["nos_task_id"]
            isOneToOne: false
            referencedRelation: "nos_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "design_jobs_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          bubble_id: string | null
          chinese_display: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          name: string | null
          region: string | null
          region_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          region?: string | null
          region_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          region?: string | null
          region_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_districts_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_districts_region_id"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "nos_regions"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_control_waivers: {
        Row: {
          id: string
          bwa_project_id: string
          item_keys: string[]
          reason: string
          status: string
          applicant_id: string
          reviewer_id: string | null
          reviewer_note: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          bwa_project_id: string
          item_keys: string[]
          reason: string
          status?: string
          applicant_id: string
          reviewer_id?: string | null
          reviewer_note?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          bwa_project_id?: string
          item_keys?: string[]
          reason?: string
          status?: string
          applicant_id?: string
          reviewer_id?: string | null
          reviewer_note?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_control_waivers_bwa_project_id_fkey"
            columns: ["bwa_project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_control_waivers_applicant_id_fkey"
            columns: ["applicant_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_control_waivers_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_product_types: {
        Row: {
          expense_id: string | null
          id: string
          product_type_id: string | null
        }
        Insert: {
          expense_id?: string | null
          id?: string
          product_type_id?: string | null
        }
        Update: {
          expense_id?: string | null
          id?: string
          product_type_id?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          approve_creator: string | null
          approve_creator_id: string | null
          approved_date: string | null
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          cheque_no: string | null
          converter_input_amount: number | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          disappear: boolean | null
          due_date: string | null
          expected_payment_date: string | null
          expected_payment_date_log: Json
          factory: string | null
          factory_id: string | null
          id: string
          installment_amount: number | null
          invoice_hash: string | null
          invoice_number: string | null
          modified_date: string | null
          n_contract_type: string | null
          n_contract_type_id: string | null
          n_product_types: string | null
          n_product_types_id: string | null
          n_supplier_type: string | null
          n_supplier_type_id: string | null
          outstanding: number | null
          paid_amount: number | null
          payment_date: string | null
          payment_method: string | null
          payment_method_id: string | null
          payment_status: string | null
          pdf_file: string | null
          project: string | null
          project_id: string | null
          rank_report: string | null
          real_creator_name: string | null
          refundable: boolean | null
          remark_t: string | null
          required_po: boolean | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
          supplier_quotation_file: string | null
          type_display: string | null
        }
        Insert: {
          approve_creator?: string | null
          approve_creator_id?: string | null
          approved_date?: string | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          cheque_no?: string | null
          converter_input_amount?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          disappear?: boolean | null
          due_date?: string | null
          expected_payment_date?: string | null
          expected_payment_date_log?: Json
          factory?: string | null
          factory_id?: string | null
          id?: string
          installment_amount?: number | null
          invoice_hash?: string | null
          invoice_number?: string | null
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          n_product_types?: string | null
          n_product_types_id?: string | null
          n_supplier_type?: string | null
          n_supplier_type_id?: string | null
          outstanding?: number | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          pdf_file?: string | null
          project?: string | null
          project_id?: string | null
          rank_report?: string | null
          real_creator_name?: string | null
          refundable?: boolean | null
          remark_t?: string | null
          required_po?: boolean | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_quotation_file?: string | null
          type_display?: string | null
        }
        Update: {
          approve_creator?: string | null
          approve_creator_id?: string | null
          approved_date?: string | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          cheque_no?: string | null
          converter_input_amount?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          disappear?: boolean | null
          due_date?: string | null
          expected_payment_date?: string | null
          expected_payment_date_log?: Json
          factory?: string | null
          factory_id?: string | null
          id?: string
          installment_amount?: number | null
          invoice_hash?: string | null
          invoice_number?: string | null
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          n_product_types?: string | null
          n_product_types_id?: string | null
          n_supplier_type?: string | null
          n_supplier_type_id?: string | null
          outstanding?: number | null
          paid_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          pdf_file?: string | null
          project?: string | null
          project_id?: string | null
          rank_report?: string | null
          real_creator_name?: string | null
          refundable?: boolean | null
          remark_t?: string | null
          required_po?: boolean | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          supplier_quotation_file?: string | null
          type_display?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_expenses_approve_creator_id"
            columns: ["approve_creator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_factory_id"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_n_contract_type_id"
            columns: ["n_contract_type_id"]
            isOneToOne: false
            referencedRelation: "nos_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_n_product_types_id"
            columns: ["n_product_types_id"]
            isOneToOne: false
            referencedRelation: "product_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_n_supplier_type_id"
            columns: ["n_supplier_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_payment_method_id"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "nos_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_expenses_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      factories: {
        Row: {
          admin_level: string | null
          amount: number | null
          asana_link: string | null
          auto_level: string | null
          bubble_id: string | null
          contact_person: string | null
          created_at: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          delivery_days: string | null
          delivery_period: string | null
          display_name: string | null
          email: string | null
          factory_code: string | null
          factory_eng_name: string | null
          factory_name: string | null
          id: string
          join_date: string | null
          key_product_categories: string | null
          location: string | null
          logo: string | null
          manufacture_days: string | null
          modified_date: string | null
          moq: string | null
          outstanding: number | null
          phone: string | null
          priority: string | null
          product_quality: string | null
          project_number: number | null
          real_level: string | null
          remarks: string | null
          slug: string | null
          sort_key_categories: string | null
          status: string | null
          website: string | null
          wechat: string | null
          working_folder: string | null
        }
        Insert: {
          admin_level?: string | null
          amount?: number | null
          asana_link?: string | null
          auto_level?: string | null
          bubble_id?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          delivery_days?: string | null
          delivery_period?: string | null
          display_name?: string | null
          email?: string | null
          factory_code?: string | null
          factory_eng_name?: string | null
          factory_name?: string | null
          id?: string
          join_date?: string | null
          key_product_categories?: string | null
          location?: string | null
          logo?: string | null
          manufacture_days?: string | null
          modified_date?: string | null
          moq?: string | null
          outstanding?: number | null
          phone?: string | null
          priority?: string | null
          product_quality?: string | null
          project_number?: number | null
          real_level?: string | null
          remarks?: string | null
          slug?: string | null
          sort_key_categories?: string | null
          status?: string | null
          website?: string | null
          wechat?: string | null
          working_folder?: string | null
        }
        Update: {
          admin_level?: string | null
          amount?: number | null
          asana_link?: string | null
          auto_level?: string | null
          bubble_id?: string | null
          contact_person?: string | null
          created_at?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          delivery_days?: string | null
          delivery_period?: string | null
          display_name?: string | null
          email?: string | null
          factory_code?: string | null
          factory_eng_name?: string | null
          factory_name?: string | null
          id?: string
          join_date?: string | null
          key_product_categories?: string | null
          location?: string | null
          logo?: string | null
          manufacture_days?: string | null
          modified_date?: string | null
          moq?: string | null
          outstanding?: number | null
          phone?: string | null
          priority?: string | null
          product_quality?: string | null
          project_number?: number | null
          real_level?: string | null
          remarks?: string | null
          slug?: string | null
          sort_key_categories?: string | null
          status?: string | null
          website?: string | null
          wechat?: string | null
          working_folder?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_factories_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_files: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          factory: string | null
          factory_id: string | null
          file: string | null
          file_name: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          factory?: string | null
          factory_id?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          factory?: string | null
          factory_id?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_factory_files_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_factory_files_factory_id"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_years: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          date_range: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
          yy_code: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          date_range?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          yy_code?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          date_range?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          yy_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_financial_years_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      income_invoices: {
        Row: {
          bubble_id: string | null
          cost_center_bu: string | null
          cost_center_bu_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          discount_amount: number | null
          discount_description: string | null
          due_date: string | null
          enable_discount: boolean | null
          id: string
          income: string | null
          income_id: string | null
          invoice_date: string | null
          invoice_number: string | null
          main_item_amount: number | null
          main_item_name: string | null
          main_item_price: number | null
          main_item_quantity: number | null
          modified_date: string | null
          note: string | null
          pdf_branding: Json | null
          project_name: string | null
          receiver_name: string | null
          slug: string | null
          system: string | null
          total_amount: number | null
        }
        Insert: {
          bubble_id?: string | null
          cost_center_bu?: string | null
          cost_center_bu_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          discount_amount?: number | null
          discount_description?: string | null
          due_date?: string | null
          enable_discount?: boolean | null
          id?: string
          income?: string | null
          income_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          main_item_amount?: number | null
          main_item_name?: string | null
          main_item_price?: number | null
          main_item_quantity?: number | null
          modified_date?: string | null
          note?: string | null
          pdf_branding?: Json | null
          project_name?: string | null
          receiver_name?: string | null
          slug?: string | null
          system?: string | null
          total_amount?: number | null
        }
        Update: {
          bubble_id?: string | null
          cost_center_bu?: string | null
          cost_center_bu_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          discount_amount?: number | null
          discount_description?: string | null
          due_date?: string | null
          enable_discount?: boolean | null
          id?: string
          income?: string | null
          income_id?: string | null
          invoice_date?: string | null
          invoice_number?: string | null
          main_item_amount?: number | null
          main_item_name?: string | null
          main_item_price?: number | null
          main_item_quantity?: number | null
          modified_date?: string | null
          note?: string | null
          pdf_branding?: Json | null
          project_name?: string | null
          receiver_name?: string | null
          slug?: string | null
          system?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_income_invoices_cost_center_bu_id"
            columns: ["cost_center_bu_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_income_invoices_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_income_invoices_income_id"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
        ]
      }
      income_expiry_reasons: {
        Row: {
          created_date: string | null
          display: string
          id: string
          is_active: boolean
          modified_date: string | null
          sort: number
        }
        Insert: {
          created_date?: string | null
          display: string
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sort?: number
        }
        Update: {
          created_date?: string | null
          display?: string
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sort?: number
        }
        Relationships: []
      }
      incomes: {
        Row: {
          ao_client_follow_up: string | null
          ao_design_firm_status: string | null
          ao_issue_date: string | null
          ao_quotation_firm_date: string | null
          ao_request_date: string | null
          ao_work_days: number | null
          ao_work_status: string | null
          approve_creator: string | null
          approve_creator_id: string | null
          approved_date: string | null
          bad_debts: number | null
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          crm_status: string | null
          date_remark: string | null
          due_date: string | null
          expected_payment_date: string | null
          expected_payment_date_log: Json
          expiry_reason_id: string | null
          id: string
          income_amount: number | null
          invoice_hash: string | null
          invoice_number: string | null
          modified_date: string | null
          n_contract_type: string | null
          n_contract_type_id: string | null
          outstanding: number | null
          outstanding_remark: string | null
          payment_amount: number | null
          payment_method: string | null
          payment_method_id: string | null
          payment_status: string | null
          pdf_file: string | null
          project: string | null
          project_id: string | null
          real_creator_name: string | null
          receive_date: string | null
          remark: string | null
          slug: string | null
          status: string | null
          type_display: string | null
        }
        Insert: {
          ao_client_follow_up?: string | null
          ao_design_firm_status?: string | null
          ao_issue_date?: string | null
          ao_quotation_firm_date?: string | null
          ao_request_date?: string | null
          ao_work_days?: number | null
          ao_work_status?: string | null
          approve_creator?: string | null
          approve_creator_id?: string | null
          approved_date?: string | null
          bad_debts?: number | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          crm_status?: string | null
          date_remark?: string | null
          due_date?: string | null
          expected_payment_date?: string | null
          expected_payment_date_log?: Json
          expiry_reason_id?: string | null
          id?: string
          income_amount?: number | null
          invoice_hash?: string | null
          invoice_number?: string | null
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          outstanding?: number | null
          outstanding_remark?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          pdf_file?: string | null
          project?: string | null
          project_id?: string | null
          real_creator_name?: string | null
          receive_date?: string | null
          remark?: string | null
          slug?: string | null
          status?: string | null
          type_display?: string | null
        }
        Update: {
          ao_client_follow_up?: string | null
          ao_design_firm_status?: string | null
          ao_issue_date?: string | null
          ao_quotation_firm_date?: string | null
          ao_request_date?: string | null
          ao_work_days?: number | null
          ao_work_status?: string | null
          approve_creator?: string | null
          approve_creator_id?: string | null
          approved_date?: string | null
          bad_debts?: number | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          crm_status?: string | null
          date_remark?: string | null
          due_date?: string | null
          expected_payment_date?: string | null
          expected_payment_date_log?: Json
          expiry_reason_id?: string | null
          id?: string
          income_amount?: number | null
          invoice_hash?: string | null
          invoice_number?: string | null
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          outstanding?: number | null
          outstanding_remark?: string | null
          payment_amount?: number | null
          payment_method?: string | null
          payment_method_id?: string | null
          payment_status?: string | null
          pdf_file?: string | null
          project?: string | null
          project_id?: string | null
          real_creator_name?: string | null
          receive_date?: string | null
          remark?: string | null
          slug?: string | null
          status?: string | null
          type_display?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_incomes_approve_creator_id"
            columns: ["approve_creator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incomes_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incomes_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incomes_n_contract_type_id"
            columns: ["n_contract_type_id"]
            isOneToOne: false
            referencedRelation: "nos_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incomes_payment_method_id"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "nos_payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_incomes_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "incomes_expiry_reason_id_fkey"
            columns: ["expiry_reason_id"]
            isOneToOne: false
            referencedRelation: "income_expiry_reasons"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_comments: {
        Row: {
          bubble_id: string | null
          bwf_pitching: string | null
          bwf_pitching_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          comment: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          evaluator: string | null
          evaluator_id: string | null
          id: string
          modified_date: string | null
          pitching: string | null
          pitching_id: string | null
          point: number | null
          project: string | null
          project_id: string | null
          rating_client_relation: number | null
          rating_design_creativity: number | null
          rating_document_logic: number | null
          rating_drawing_accuracy: number | null
          rating_professional_briefing: number | null
          rating_supplier_relation: number | null
          slug: string | null
          staff: string | null
          staff_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          rating_client_relation?: number | null
          rating_design_creativity?: number | null
          rating_document_logic?: number | null
          rating_drawing_accuracy?: number | null
          rating_professional_briefing?: number | null
          rating_supplier_relation?: number | null
          slug?: string | null
          staff?: string | null
          staff_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          rating_client_relation?: number | null
          rating_design_creativity?: number | null
          rating_document_logic?: number | null
          rating_drawing_accuracy?: number | null
          rating_professional_briefing?: number | null
          rating_supplier_relation?: number | null
          slug?: string | null
          staff?: string | null
          staff_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_internal_comments_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_evaluator_id"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_internal_comments_staff_id"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_sub_items: {
        Row: {
          amount: number | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          invoice: string | null
          invoice_id: string | null
          item_name: string | null
          modified_date: string | null
          price: number | null
          quantity: number | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          invoice?: string | null
          invoice_id?: string | null
          item_name?: string | null
          modified_date?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          invoice?: string | null
          invoice_id?: string | null
          item_name?: string | null
          modified_date?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_invoice_sub_items_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_invoice_sub_items_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "income_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      login_logs: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          email: string | null
          id: string
          ip: string | null
          modified_date: string | null
          password: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          modified_date?: string | null
          password?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          modified_date?: string | null
          password?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_login_logs_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      man_hour_dates: {
        Row: {
          bubble_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          report_date: string
          staff_bubble_id: string | null
          staff_id: string | null
          total_work_hour: number | null
          updated_at: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_date: string
          staff_bubble_id?: string | null
          staff_id?: string | null
          total_work_hour?: number | null
          updated_at?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          report_date?: string
          staff_bubble_id?: string | null
          staff_id?: string | null
          total_work_hour?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "man_hour_dates_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      man_hour_pinned: {
        Row: {
          created_at: string | null
          id: string
          pin_type: string
          project_id: string | null
          project_name: string | null
          sorting: number | null
          staff_id: string
          task_bubble_id: string | null
          task_name: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          pin_type: string
          project_id?: string | null
          project_name?: string | null
          sorting?: number | null
          staff_id: string
          task_bubble_id?: string | null
          task_name?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          pin_type?: string
          project_id?: string | null
          project_name?: string | null
          sorting?: number | null
          staff_id?: string
          task_bubble_id?: string | null
          task_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "man_hour_pinned_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      man_hour_tasks: {
        Row: {
          ai_tools: Json | null
          asana_link: string | null
          brand_bubble_id: string | null
          brand_name: string | null
          bubble_id: string | null
          created_at: string | null
          created_by: string | null
          deliverables: Json | null
          design_job_id: string | null
          design_stage: string | null
          id: string
          images: string[] | null
          job_type: string | null
          keywords: string | null
          man_hour_date_bubble_id: string | null
          man_hour_date_id: string | null
          meeting_duration: string | null
          meeting_invite_sent: boolean | null
          meeting_method: string | null
          meeting_participants: string[] | null
          meeting_request_date: string | null
          meeting_topic: string | null
          output_count: number | null
          output_unit: string | null
          progress_pct: number | null
          project_bubble_id: string | null
          project_id: string | null
          project_name: string | null
          task_bubble_id: string | null
          task_description: string | null
          task_name: string | null
          task_type: string | null
          task_type_bubble_id: string | null
          updated_at: string | null
          work_hour: number
          work_location: string | null
        }
        Insert: {
          ai_tools?: Json | null
          asana_link?: string | null
          brand_bubble_id?: string | null
          brand_name?: string | null
          bubble_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deliverables?: Json | null
          design_job_id?: string | null
          design_stage?: string | null
          id?: string
          images?: string[] | null
          job_type?: string | null
          keywords?: string | null
          man_hour_date_bubble_id?: string | null
          man_hour_date_id?: string | null
          meeting_duration?: string | null
          meeting_invite_sent?: boolean | null
          meeting_method?: string | null
          meeting_participants?: string[] | null
          meeting_request_date?: string | null
          meeting_topic?: string | null
          output_count?: number | null
          output_unit?: string | null
          progress_pct?: number | null
          project_bubble_id?: string | null
          project_id?: string | null
          project_name?: string | null
          task_bubble_id?: string | null
          task_description?: string | null
          task_name?: string | null
          task_type?: string | null
          task_type_bubble_id?: string | null
          updated_at?: string | null
          work_hour?: number
          work_location?: string | null
        }
        Update: {
          ai_tools?: Json | null
          asana_link?: string | null
          brand_bubble_id?: string | null
          brand_name?: string | null
          bubble_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deliverables?: Json | null
          design_job_id?: string | null
          design_stage?: string | null
          id?: string
          images?: string[] | null
          job_type?: string | null
          keywords?: string | null
          man_hour_date_bubble_id?: string | null
          man_hour_date_id?: string | null
          meeting_duration?: string | null
          meeting_invite_sent?: boolean | null
          meeting_method?: string | null
          meeting_participants?: string[] | null
          meeting_request_date?: string | null
          meeting_topic?: string | null
          output_count?: number | null
          output_unit?: string | null
          progress_pct?: number | null
          project_bubble_id?: string | null
          project_id?: string | null
          project_name?: string | null
          task_bubble_id?: string | null
          task_description?: string | null
          task_name?: string | null
          task_type?: string | null
          task_type_bubble_id?: string | null
          updated_at?: string | null
          work_hour?: number
          work_location?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "man_hour_tasks_design_job_id_fkey"
            columns: ["design_job_id"]
            isOneToOne: false
            referencedRelation: "design_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "man_hour_tasks_man_hour_date_id_fkey"
            columns: ["man_hour_date_id"]
            isOneToOne: false
            referencedRelation: "man_hour_dates"
            referencedColumns: ["id"]
          },
        ]
      }
      news: {
        Row: {
          banner_image: string | null
          body_text: string | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          creator_member: string | null
          creator_member_id: string | null
          id: string
          is_active: boolean | null
          liked_count: number | null
          liked_member: string | null
          modified_date: string | null
          nos_news_type: string | null
          nos_news_type_id: string | null
          slug: string | null
          title: string | null
          view_count: number | null
        }
        Insert: {
          banner_image?: string | null
          body_text?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          creator_member?: string | null
          creator_member_id?: string | null
          id?: string
          is_active?: boolean | null
          liked_count?: number | null
          liked_member?: string | null
          modified_date?: string | null
          nos_news_type?: string | null
          nos_news_type_id?: string | null
          slug?: string | null
          title?: string | null
          view_count?: number | null
        }
        Update: {
          banner_image?: string | null
          body_text?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          creator_member?: string | null
          creator_member_id?: string | null
          id?: string
          is_active?: boolean | null
          liked_count?: number | null
          liked_member?: string | null
          modified_date?: string | null
          nos_news_type?: string | null
          nos_news_type_id?: string | null
          slug?: string | null
          title?: string | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_news_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_news_creator_member_id"
            columns: ["creator_member_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_news_nos_news_type_id"
            columns: ["nos_news_type_id"]
            isOneToOne: false
            referencedRelation: "news_types"
            referencedColumns: ["id"]
          },
        ]
      }
      news_comment_liked_members: {
        Row: {
          comment_id: string | null
          id: string
          member_id: string | null
        }
        Insert: {
          comment_id?: string | null
          id?: string
          member_id?: string | null
        }
        Update: {
          comment_id?: string | null
          id?: string
          member_id?: string | null
        }
        Relationships: []
      }
      news_comments: {
        Row: {
          bubble_id: string | null
          comment: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          creator_member: string | null
          creator_member_id: string | null
          id: string
          liked_count: number | null
          liked_member: string | null
          modified_date: string | null
          news: string | null
          news_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          creator_member?: string | null
          creator_member_id?: string | null
          id?: string
          liked_count?: number | null
          liked_member?: string | null
          modified_date?: string | null
          news?: string | null
          news_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          creator_member?: string | null
          creator_member_id?: string | null
          id?: string
          liked_count?: number | null
          liked_member?: string | null
          modified_date?: string | null
          news?: string | null
          news_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_news_comments_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_news_comments_creator_member_id"
            columns: ["creator_member_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_news_comments_news_id"
            columns: ["news_id"]
            isOneToOne: false
            referencedRelation: "news"
            referencedColumns: ["id"]
          },
        ]
      }
      news_liked_members: {
        Row: {
          id: string
          member_id: string | null
          news_id: string | null
        }
        Insert: {
          id?: string
          member_id?: string | null
          news_id?: string | null
        }
        Update: {
          id?: string
          member_id?: string | null
          news_id?: string | null
        }
        Relationships: []
      }
      news_types: {
        Row: {
          bubble_id: string | null
          color: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          is_active: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          color?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          color?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_news_types_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_ai_quote_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_ai_quote_types_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_ai_tool_types: {
        Row: {
          code: string
          created_date: string | null
          display: string
          eng_display: string | null
          id: string
          is_active: boolean
          modified_date: string | null
          sorting: number
        }
        Insert: {
          code: string
          created_date?: string | null
          display: string
          eng_display?: string | null
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sorting?: number
        }
        Update: {
          code?: string
          created_date?: string | null
          display?: string
          eng_display?: string | null
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sorting?: number
        }
        Relationships: []
      }
      nos_ai_tools: {
        Row: {
          category: string
          created_date: string | null
          display: string
          id: string
          is_active: boolean
          modified_date: string | null
          sorting: number
        }
        Insert: {
          category: string
          created_date?: string | null
          display: string
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sorting?: number
        }
        Update: {
          category?: string
          created_date?: string | null
          display?: string
          id?: string
          is_active?: boolean
          modified_date?: string | null
          sorting?: number
        }
        Relationships: [
          {
            foreignKeyName: "nos_ai_tools_category_fkey"
            columns: ["category"]
            isOneToOne: false
            referencedRelation: "nos_ai_tool_types"
            referencedColumns: ["code"]
          },
        ]
      }
      nos_brands: {
        Row: {
          brand_name: string | null
          bubble_id: string | null
          created_at: string | null
          display: string
          id: string
          is_active: boolean | null
          updated_at: string | null
        }
        Insert: {
          brand_name?: string | null
          bubble_id?: string | null
          created_at?: string | null
          display: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Update: {
          brand_name?: string | null
          bubble_id?: string | null
          created_at?: string | null
          display?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nos_bv_values: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
          value: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          value?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_bv_values_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_contracts: {
        Row: {
          bubble_id: string | null
          chinese_display: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          is_ao: boolean | null
          is_recurring: boolean | null
          modified_date: string | null
          rank: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_ao?: boolean | null
          is_recurring?: boolean | null
          modified_date?: string | null
          rank?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_ao?: boolean | null
          is_recurring?: boolean | null
          modified_date?: string | null
          rank?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_contracts_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_cr_delivery_methods: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_cr_delivery_methods_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_cr_event_themes: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
          value: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          value?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_cr_event_themes_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_cr_event_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_cr_event_types_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_customer_purpose: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          english_display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          english_display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          english_display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_customer_purpose_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_customer_tags: {
        Row: {
          bubble_id: string | null
          collection: string | null
          collection_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          collection?: string | null
          collection_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          collection?: string | null
          collection_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_customer_tags_collection_id"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "nos_customer_tags_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_customer_tags_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_customer_tags_collection: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          order: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_customer_tags_collection_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_defect_causes: {
        Row: {
          bubble_id: string | null
          chin_display: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display: string | null
          id: string
          is_active: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_defect_causes_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_doc_types: {
        Row: {
          bubble_id: string | null
          category: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          enable_doc_date: boolean | null
          enable_expiry_date: boolean | null
          id: string
          is_project_initial_doc: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          category?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          enable_doc_date?: boolean | null
          enable_expiry_date?: boolean | null
          id?: string
          is_project_initial_doc?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          category?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          enable_doc_date?: boolean | null
          enable_expiry_date?: boolean | null
          id?: string
          is_project_initial_doc?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_item_quote_project_types: {
        Row: {
          created_at: string | null
          id: string
          nos_item_id: string
          quote_project_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nos_item_id: string
          quote_project_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nos_item_id?: string
          quote_project_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_niqpt_nos_item_id"
            columns: ["nos_item_id"]
            isOneToOne: false
            referencedRelation: "nos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_niqpt_quote_project_type_id"
            columns: ["quote_project_type_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_items: {
        Row: {
          bubble_id: string | null
          chinese_name: string | null
          cost: number | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          english_name: string | null
          id: string
          modified_date: string | null
          quote_project_type: string | null
          remark: string | null
          section: string | null
          section_id: string | null
          slug: string | null
          status: string | null
          unit: string | null
          unit_id: string | null
          unit_price: number | null
          updated: boolean | null
        }
        Insert: {
          bubble_id?: string | null
          chinese_name?: string | null
          cost?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          english_name?: string | null
          id?: string
          modified_date?: string | null
          quote_project_type?: string | null
          remark?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          status?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_price?: number | null
          updated?: boolean | null
        }
        Update: {
          bubble_id?: string | null
          chinese_name?: string | null
          cost?: number | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          english_name?: string | null
          id?: string
          modified_date?: string | null
          quote_project_type?: string | null
          remark?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          status?: string | null
          unit?: string | null
          unit_id?: string | null
          unit_price?: number | null
          updated?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_items_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_items_section_id"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "nos_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_items_unit_id"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "nos_units"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_payment_methods: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_quote_project_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          name: string | null
          order: number | null
          prompt: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          order?: number | null
          prompt?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          order?: number | null
          prompt?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_regions: {
        Row: {
          bubble_id: string | null
          chn_display: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chn_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chn_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_sections: {
        Row: {
          bubble_id: string | null
          chinese_name: string | null
          created_by: string | null
          created_date: string | null
          english_name: string | null
          id: string
          modified_date: string | null
          order: number | null
          quote_project: string | null
          quote_project_id: string | null
          search_type: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chinese_name?: string | null
          created_by?: string | null
          created_date?: string | null
          english_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quote_project?: string | null
          quote_project_id?: string | null
          search_type?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chinese_name?: string | null
          created_by?: string | null
          created_date?: string | null
          english_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quote_project?: string | null
          quote_project_id?: string | null
          search_type?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_sections_quote_project_id"
            columns: ["quote_project_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_service_type_2: {
        Row: {
          bubble_id: string | null
          code: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_fast_build: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_fast_build?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_fast_build?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_site_status_items: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          display_en: string | null
          id: string
          is_active: boolean | null
          modified_date: string | null
          os_ss_item_type: string | null
          slug: string | null
          sort_order: number | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          display_en?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          os_ss_item_type?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          display_en?: string | null
          id?: string
          is_active?: boolean | null
          modified_date?: string | null
          os_ss_item_type?: string | null
          slug?: string | null
          sort_order?: number | null
        }
        Relationships: []
      }
      nos_supplier_tags: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
          tag_name: string | null
          tag_type: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          tag_name?: string | null
          tag_type?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          tag_name?: string | null
          tag_type?: string | null
        }
        Relationships: []
      }
      nos_task_types: {
        Row: {
          brand_ids: string[] | null
          bubble_id: string | null
          created_at: string | null
          display: string
          eng_display: string | null
          id: string
          is_active: boolean | null
          require_project_link: boolean | null
          team_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          brand_ids?: string[] | null
          bubble_id?: string | null
          created_at?: string | null
          display: string
          eng_display?: string | null
          id?: string
          is_active?: boolean | null
          require_project_link?: boolean | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          brand_ids?: string[] | null
          bubble_id?: string | null
          created_at?: string | null
          display?: string
          eng_display?: string | null
          id?: string
          is_active?: boolean | null
          require_project_link?: boolean | null
          team_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nos_tasks: {
        Row: {
          bubble_id: string | null
          created_at: string | null
          display: string
          eng_display: string | null
          id: string
          is_active: boolean | null
          require_deliverables: boolean
          sorting: number | null
          task_type_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_at?: string | null
          display: string
          eng_display?: string | null
          id?: string
          is_active?: boolean | null
          require_deliverables?: boolean
          sorting?: number | null
          task_type_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_at?: string | null
          display?: string
          eng_display?: string | null
          id?: string
          is_active?: boolean | null
          require_deliverables?: boolean
          sorting?: number | null
          task_type_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      nos_template_items: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          item: string | null
          item_id: string | null
          modified_date: string | null
          slug: string | null
          template: string | null
          template_id: string | null
          template_section: string | null
          template_section_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          modified_date?: string | null
          slug?: string | null
          template?: string | null
          template_id?: string | null
          template_section?: string | null
          template_section_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          modified_date?: string | null
          slug?: string | null
          template?: string | null
          template_id?: string | null
          template_section?: string | null
          template_section_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_template_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_template_items_template_id"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "nos_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_template_items_template_section_id"
            columns: ["template_section_id"]
            isOneToOne: false
            referencedRelation: "nos_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_template_sections: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          section: string | null
          section_id: string | null
          slug: string | null
          template: string | null
          template_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          template?: string | null
          template_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          template?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_nos_template_sections_section_id"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "nos_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_nos_template_sections_template_id"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "nos_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      nos_templates: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          name: string | null
          project_type: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          project_type?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          project_type?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_tender_reject_presets: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_units: {
        Row: {
          bubble_id: string | null
          chi_name: string | null
          created_by: string | null
          created_date: string | null
          eng_name: string | null
          id: string
          modified_date: string | null
          order: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chi_name?: string | null
          created_by?: string | null
          created_date?: string | null
          eng_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chi_name?: string | null
          created_by?: string | null
          created_date?: string | null
          eng_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_website_functions: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          english_display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          english_display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          english_display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      nos_work_locations: {
        Row: {
          bubble_id: string | null
          created_at: string | null
          display: string
          id: string
          is_active: boolean | null
          is_china: boolean | null
          is_gps: boolean | null
          is_hk: boolean | null
          updated_at: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_at?: string | null
          display: string
          id?: string
          is_active?: boolean | null
          is_china?: boolean | null
          is_gps?: boolean | null
          is_hk?: boolean | null
          updated_at?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_at?: string | null
          display?: string
          id?: string
          is_active?: boolean | null
          is_china?: boolean | null
          is_gps?: boolean | null
          is_hk?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      notification_seen: {
        Row: {
          id: string
          notification_id: string | null
          seen_id: string | null
        }
        Insert: {
          id?: string
          notification_id?: string | null
          seen_id?: string | null
        }
        Update: {
          id?: string
          notification_id?: string | null
          seen_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          bwa_project_id: string | null
          bwf_project_id: string | null
          created_at: string
          delivery: Json
          expense_id: string | null
          id: string
          income_id: string | null
          is_read: boolean
          link_url: string | null
          message: string | null
          metadata: Json | null
          read_at: string | null
          recipient_staff_id: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          bwa_project_id?: string | null
          bwf_project_id?: string | null
          created_at?: string
          delivery?: Json
          expense_id?: string | null
          id?: string
          income_id?: string | null
          is_read?: boolean
          link_url?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_staff_id: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          bwa_project_id?: string | null
          bwf_project_id?: string | null
          created_at?: string
          delivery?: Json
          expense_id?: string | null
          id?: string
          income_id?: string | null
          is_read?: boolean
          link_url?: string | null
          message?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_staff_id?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_bwa_project_id_fkey"
            columns: ["bwa_project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_bwf_project_id_fkey"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_income_id_fkey"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_staff_id_fkey"
            columns: ["recipient_staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      outstanding_remarks: {
        Row: {
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          crm_status: string | null
          id: string
          modified_date: string | null
          n_contract_type: string | null
          n_contract_type_id: string | null
          project: string | null
          project_id: string | null
          remarks: string | null
          slug: string | null
          url: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          crm_status?: string | null
          id?: string
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          project?: string | null
          project_id?: string | null
          remarks?: string | null
          slug?: string | null
          url?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          crm_status?: string | null
          id?: string
          modified_date?: string | null
          n_contract_type?: string | null
          n_contract_type_id?: string | null
          project?: string | null
          project_id?: string | null
          remarks?: string | null
          slug?: string | null
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_outstanding_remarks_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_outstanding_remarks_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_outstanding_remarks_n_contract_type_id"
            columns: ["n_contract_type_id"]
            isOneToOne: false
            referencedRelation: "nos_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_outstanding_remarks_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      permission_assignments: {
        Row: {
          created_at: string | null
          dimension: string
          dimension_value: string
          effect: string
          id: string
          permission_id: string
          priority: number
        }
        Insert: {
          created_at?: string | null
          dimension: string
          dimension_value: string
          effect: string
          id?: string
          permission_id: string
          priority?: number
        }
        Update: {
          created_at?: string | null
          dimension?: string
          dimension_value?: string
          effect?: string
          id?: string
          permission_id?: string
          priority?: number
        }
        Relationships: [
          {
            foreignKeyName: "permission_assignments_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          action: string
          created_at: string | null
          display_name: string | null
          id: string
          module: string
        }
        Insert: {
          action: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          module: string
        }
        Update: {
          action?: string
          created_at?: string | null
          display_name?: string | null
          id?: string
          module?: string
        }
        Relationships: []
      }
      pitching_bv: {
        Row: {
          bubble_id: string | null
          bwf_pitching: string | null
          bwf_pitching_id: string | null
          case_closed_count: number | null
          created_by: string | null
          created_date: string | null
          enquiry_date: string | null
          handler: string | null
          handler_id: string | null
          id: string
          modified_date: string | null
          pitching: string | null
          pitching_count: number | null
          pitching_id: string | null
          pitching_status: string | null
          project: string | null
          project_count: number | null
          quotation_count: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          case_closed_count?: number | null
          created_by?: string | null
          created_date?: string | null
          enquiry_date?: string | null
          handler?: string | null
          handler_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_count?: number | null
          pitching_id?: string | null
          pitching_status?: string | null
          project?: string | null
          project_count?: number | null
          quotation_count?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          case_closed_count?: number | null
          created_by?: string | null
          created_date?: string | null
          enquiry_date?: string | null
          handler?: string | null
          handler_id?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_count?: number | null
          pitching_id?: string | null
          pitching_status?: string | null
          project?: string | null
          project_count?: number | null
          quotation_count?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pitching_bv_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pitching_bv_handler_id"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pitching_bv_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
        ]
      }
      pitching_close_reasons: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_bwf: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      po_sub_items: {
        Row: {
          amount: number | null
          bubble_id: string | null
          completion_date: string | null
          created_by: string | null
          created_date: string | null
          description: string | null
          id: string
          is_active: boolean | null
          item_name: string | null
          modified_date: string | null
          po: string | null
          price: number | null
          quantity: number | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          completion_date?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_name?: string | null
          modified_date?: string | null
          po?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          completion_date?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          item_name?: string | null
          modified_date?: string | null
          po?: string | null
          price?: number | null
          quantity?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      product_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      project_bv: {
        Row: {
          actual_bv: number | null
          actual_gp: number | null
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_date: string | null
          estimated_bv: number | null
          estimated_gp: number | null
          handler: string | null
          handler_id: string | null
          handover_date: string | null
          id: string
          modified_date: string | null
          n_financial_year: string | null
          n_financial_year_id: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          project: string | null
          project_id: string | null
          ratio: number | null
          shared_actual_gp: number | null
          shared_estimated_gp: number | null
          signed_date: string | null
          slug: string | null
          total_sales: number | null
        }
        Insert: {
          actual_bv?: number | null
          actual_gp?: number | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_date?: string | null
          estimated_bv?: number | null
          estimated_gp?: number | null
          handler?: string | null
          handler_id?: string | null
          handover_date?: string | null
          id?: string
          modified_date?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          project?: string | null
          project_id?: string | null
          ratio?: number | null
          shared_actual_gp?: number | null
          shared_estimated_gp?: number | null
          signed_date?: string | null
          slug?: string | null
          total_sales?: number | null
        }
        Update: {
          actual_bv?: number | null
          actual_gp?: number | null
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_date?: string | null
          estimated_bv?: number | null
          estimated_gp?: number | null
          handler?: string | null
          handler_id?: string | null
          handover_date?: string | null
          id?: string
          modified_date?: string | null
          n_financial_year?: string | null
          n_financial_year_id?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          project?: string | null
          project_id?: string | null
          ratio?: number | null
          shared_actual_gp?: number | null
          shared_estimated_gp?: number | null
          signed_date?: string | null
          slug?: string | null
          total_sales?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_bv_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_bv_handler_id"
            columns: ["handler_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_bv_n_financial_year_id"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_bv_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_bv_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_documents: {
        Row: {
          bubble_id: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          doc_name: string | null
          doc_type: string | null
          doc_type_id: string | null
          document_date: string | null
          expiry_date: string | null
          file: string | null
          id: string
          modified_date: string | null
          pitching: string | null
          pitching_id: string | null
          project: string | null
          project_id: string | null
          remark: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          doc_name?: string | null
          doc_type?: string | null
          doc_type_id?: string | null
          document_date?: string | null
          expiry_date?: string | null
          file?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          remark?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          doc_name?: string | null
          doc_type?: string | null
          doc_type_id?: string | null
          document_date?: string | null
          expiry_date?: string | null
          file?: string | null
          id?: string
          modified_date?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          remark?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_documents_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_documents_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_documents_doc_type_id"
            columns: ["doc_type_id"]
            isOneToOne: false
            referencedRelation: "nos_doc_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_documents_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_documents_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_initial_expenses: {
        Row: {
          amount: number | null
          bubble_id: string | null
          bwf_pitching_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          n_expense_type: string | null
          n_expense_type_id: string | null
          pitching: string | null
          pitching_id: string | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          bwf_pitching_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          n_expense_type?: string | null
          n_expense_type_id?: string | null
          pitching?: string | null
          pitching_id?: string | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          bwf_pitching_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          n_expense_type?: string | null
          n_expense_type_id?: string | null
          pitching?: string | null
          pitching_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_initial_expenses_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_initial_expenses_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_initial_expenses_n_expense_type_id"
            columns: ["n_expense_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_initial_expenses_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schedule_tasks: {
        Row: {
          bubble_id: string | null
          bwf_project_with_custom: string | null
          bwf_project_with_custom_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_bwa: boolean | null
          is_bwf_ob: boolean | null
          is_custom: boolean | null
          is_fast_build: boolean | null
          is_handover_date: boolean | null
          is_start_date: boolean | null
          modified_date: string | null
          os_schedule_groups: string | null
          os_schedule_groups_id: string | null
          project_with_custom: string | null
          project_with_custom_id: string | null
          slug: string | null
          sort: number | null
          stage: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project_with_custom?: string | null
          bwf_project_with_custom_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_bwa?: boolean | null
          is_bwf_ob?: boolean | null
          is_custom?: boolean | null
          is_fast_build?: boolean | null
          is_handover_date?: boolean | null
          is_start_date?: boolean | null
          modified_date?: string | null
          os_schedule_groups?: string | null
          os_schedule_groups_id?: string | null
          project_with_custom?: string | null
          project_with_custom_id?: string | null
          slug?: string | null
          sort?: number | null
          stage?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project_with_custom?: string | null
          bwf_project_with_custom_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_bwa?: boolean | null
          is_bwf_ob?: boolean | null
          is_custom?: boolean | null
          is_fast_build?: boolean | null
          is_handover_date?: boolean | null
          is_start_date?: boolean | null
          modified_date?: string | null
          os_schedule_groups?: string | null
          os_schedule_groups_id?: string | null
          project_with_custom?: string | null
          project_with_custom_id?: string | null
          slug?: string | null
          sort?: number | null
          stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_schedule_tasks_bwf_project_with_custom_id"
            columns: ["bwf_project_with_custom_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedule_tasks_os_schedule_groups_id"
            columns: ["os_schedule_groups_id"]
            isOneToOne: false
            referencedRelation: "project_schedule_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedule_tasks_project_with_custom_id"
            columns: ["project_with_custom_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_schedules: {
        Row: {
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          created_by: string | null
          created_date: string | null
          date: string | null
          id: string
          is_na: boolean | null
          main_pm: string | null
          main_pm_id: string | null
          modified_date: string | null
          payment_schedule: string | null
          payment_schedule_id: string | null
          project: string | null
          project_id: string | null
          schedule_type: string | null
          slug: string | null
          working_schedule: string | null
          working_schedule_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_date?: string | null
          date?: string | null
          id?: string
          is_na?: boolean | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          payment_schedule?: string | null
          payment_schedule_id?: string | null
          project?: string | null
          project_id?: string | null
          schedule_type?: string | null
          slug?: string | null
          working_schedule?: string | null
          working_schedule_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          created_by?: string | null
          created_date?: string | null
          date?: string | null
          id?: string
          is_na?: boolean | null
          main_pm?: string | null
          main_pm_id?: string | null
          modified_date?: string | null
          payment_schedule?: string | null
          payment_schedule_id?: string | null
          project?: string | null
          project_id?: string | null
          schedule_type?: string | null
          slug?: string | null
          working_schedule?: string | null
          working_schedule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_schedules_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedules_main_pm_id"
            columns: ["main_pm_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedules_payment_schedule_id"
            columns: ["payment_schedule_id"]
            isOneToOne: false
            referencedRelation: "project_schedule_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedules_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_schedules_working_schedule_id"
            columns: ["working_schedule_id"]
            isOneToOne: false
            referencedRelation: "project_schedule_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      project_types: {
        Row: {
          bubble_id: string | null
          chin_display: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          site_status_required: boolean
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          site_status_required?: boolean
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          site_status_required?: boolean
          slug?: string | null
        }
        Relationships: []
      }
      project_weekly_reports: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          display_project_name: string | null
          file: string | null
          id: string
          meeting_date: string | null
          modified_date: string | null
          project: string | null
          project_id: string | null
          report_name: string | null
          slug: string | null
          week_number: number | null
          za_meeting_team: string | null
          zb_key_focus: string | null
          zc_completed_work: string | null
          zd_next_week_work: string | null
          ze_additional_items: string | null
          zf_urgent_client_confirm: string | null
          zg_site_changes: string | null
          zh_factors_affecting_handover: string | null
          zi_overall_site_schedule: string | null
          zj_payment_schedule: string | null
          zk_appendix: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display_project_name?: string | null
          file?: string | null
          id?: string
          meeting_date?: string | null
          modified_date?: string | null
          project?: string | null
          project_id?: string | null
          report_name?: string | null
          slug?: string | null
          week_number?: number | null
          za_meeting_team?: string | null
          zb_key_focus?: string | null
          zc_completed_work?: string | null
          zd_next_week_work?: string | null
          ze_additional_items?: string | null
          zf_urgent_client_confirm?: string | null
          zg_site_changes?: string | null
          zh_factors_affecting_handover?: string | null
          zi_overall_site_schedule?: string | null
          zj_payment_schedule?: string | null
          zk_appendix?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          display_project_name?: string | null
          file?: string | null
          id?: string
          meeting_date?: string | null
          modified_date?: string | null
          project?: string | null
          project_id?: string | null
          report_name?: string | null
          slug?: string | null
          week_number?: number | null
          za_meeting_team?: string | null
          zb_key_focus?: string | null
          zc_completed_work?: string | null
          zd_next_week_work?: string | null
          ze_additional_items?: string | null
          zf_urgent_client_confirm?: string | null
          zg_site_changes?: string | null
          zh_factors_affecting_handover?: string | null
          zi_overall_site_schedule?: string | null
          zj_payment_schedule?: string | null
          zk_appendix?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_project_weekly_reports_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_project_weekly_reports_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          bubble_id: string | null
          cost_centre: string | null
          cost_centre_id: string | null
          created_by: string | null
          created_date: string | null
          expense: string | null
          id: string
          is_active: boolean | null
          main_item_amount: number | null
          main_item_completion_date: string | null
          main_item_description: string | null
          main_item_name: string | null
          main_item_price: number | null
          main_item_quantity: number | null
          modified_date: string | null
          payment_terms: string | null
          po_date: string | null
          po_number: string | null
          project_name: string | null
          receiver_name: string | null
          signed_date: string | null
          signed_file: string | null
          slug: string | null
          t_and_c: string | null
          total_amount: number | null
        }
        Insert: {
          bubble_id?: string | null
          cost_centre?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_date?: string | null
          expense?: string | null
          id?: string
          is_active?: boolean | null
          main_item_amount?: number | null
          main_item_completion_date?: string | null
          main_item_description?: string | null
          main_item_name?: string | null
          main_item_price?: number | null
          main_item_quantity?: number | null
          modified_date?: string | null
          payment_terms?: string | null
          po_date?: string | null
          po_number?: string | null
          project_name?: string | null
          receiver_name?: string | null
          signed_date?: string | null
          signed_file?: string | null
          slug?: string | null
          t_and_c?: string | null
          total_amount?: number | null
        }
        Update: {
          bubble_id?: string | null
          cost_centre?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_date?: string | null
          expense?: string | null
          id?: string
          is_active?: boolean | null
          main_item_amount?: number | null
          main_item_completion_date?: string | null
          main_item_description?: string | null
          main_item_name?: string | null
          main_item_price?: number | null
          main_item_quantity?: number | null
          modified_date?: string | null
          payment_terms?: string | null
          po_date?: string | null
          po_number?: string | null
          project_name?: string | null
          receiver_name?: string | null
          signed_date?: string | null
          signed_file?: string | null
          slug?: string | null
          t_and_c?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_orders_cost_centre_id"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
        ]
      }
      q_term_section_details: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          description: string | null
          id: string
          modified_date: string | null
          number: string | null
          order: number | null
          quote: string | null
          quote_id: string | null
          slug: string | null
          star: boolean | null
          term_head: string | null
          term_head_id: string | null
          term_section: string | null
          total: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          modified_date?: string | null
          number?: string | null
          order?: number | null
          quote?: string | null
          quote_id?: string | null
          slug?: string | null
          star?: boolean | null
          term_head?: string | null
          term_head_id?: string | null
          term_section?: string | null
          total?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          modified_date?: string | null
          number?: string | null
          order?: number | null
          quote?: string | null
          quote_id?: string | null
          slug?: string | null
          star?: boolean | null
          term_head?: string | null
          term_head_id?: string | null
          term_section?: string | null
          total?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_q_term_section_details_quote_id"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_q_term_section_details_term_head_id"
            columns: ["term_head_id"]
            isOneToOne: false
            referencedRelation: "q_term_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      q_term_sections: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          head_name: string | null
          id: string
          modified_date: string | null
          order: number | null
          quote: string | null
          quote_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          head_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quote?: string | null
          quote_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          head_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          quote?: string | null
          quote_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_q_term_sections_quote_id"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_expenses: {
        Row: {
          amount: number | null
          bubble_id: string | null
          bwf_pitching: string | null
          bwf_pitching_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          n_expense_type: string | null
          n_expense_type_id: string | null
          pitching: string | null
          pitching_id: string | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          n_expense_type?: string | null
          n_expense_type_id?: string | null
          pitching?: string | null
          pitching_id?: string | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          bwf_pitching?: string | null
          bwf_pitching_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          n_expense_type?: string | null
          n_expense_type_id?: string | null
          pitching?: string | null
          pitching_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotation_expenses_bwf_pitching_id"
            columns: ["bwf_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwf_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_expenses_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_expenses_n_expense_type_id"
            columns: ["n_expense_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_expenses_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_section_items: {
        Row: {
          abandon: boolean | null
          bubble_id: string | null
          c_unit: string | null
          c_unit_id: string | null
          cost: number | null
          created_by: string | null
          created_date: string | null
          description: string | null
          id: string
          item: string | null
          item_id: string | null
          modified_date: string | null
          opt: boolean | null
          order_number: number | null
          quantity: number | null
          quote: string | null
          quote_id: string | null
          section: string | null
          section_id: string | null
          slug: string | null
          sub_total_cost: number | null
          sub_total_price: number | null
          unit: string | null
          unit_price: number | null
        }
        Insert: {
          abandon?: boolean | null
          bubble_id?: string | null
          c_unit?: string | null
          c_unit_id?: string | null
          cost?: number | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          modified_date?: string | null
          opt?: boolean | null
          order_number?: number | null
          quantity?: number | null
          quote?: string | null
          quote_id?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          sub_total_cost?: number | null
          sub_total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Update: {
          abandon?: boolean | null
          bubble_id?: string | null
          c_unit?: string | null
          c_unit_id?: string | null
          cost?: number | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          modified_date?: string | null
          opt?: boolean | null
          order_number?: number | null
          quantity?: number | null
          quote?: string | null
          quote_id?: string | null
          section?: string | null
          section_id?: string | null
          slug?: string | null
          sub_total_cost?: number | null
          sub_total_price?: number | null
          unit?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotation_section_items_c_unit_id"
            columns: ["c_unit_id"]
            isOneToOne: false
            referencedRelation: "nos_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_section_items_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_section_items_quote_id"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_section_items_section_id"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quotation_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quotation_sections: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          name: string | null
          order: number | null
          quotation_id: string | null
          quote: string | null
          r_section: string | null
          r_section_id: string | null
          real_order: number | null
          s_discount: number | null
          s_margin: number | null
          s_total: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          order?: number | null
          quotation_id?: string | null
          quote?: string | null
          r_section?: string | null
          r_section_id?: string | null
          real_order?: number | null
          s_discount?: number | null
          s_margin?: number | null
          s_total?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          name?: string | null
          order?: number | null
          quotation_id?: string | null
          quote?: string | null
          r_section?: string | null
          r_section_id?: string | null
          real_order?: number | null
          s_discount?: number | null
          s_margin?: number | null
          s_total?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotation_sections_quotation_id"
            columns: ["quotation_id"]
            isOneToOne: false
            referencedRelation: "quotations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotation_sections_r_section_id"
            columns: ["r_section_id"]
            isOneToOne: false
            referencedRelation: "nos_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      quotations: {
        Row: {
          bubble_id: string | null
          company_address: string | null
          company_name: string | null
          contact_person: string | null
          contact_tel: string | null
          contract_type: string | null
          contract_type_id: string | null
          cost_centre_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer_id: string | null
          date: string | null
          discount_method: string | null
          discount_percent: number | null
          discount_type_p: string | null
          email: string | null
          fixed_discount: number | null
          id: string
          l_version: string | null
          modified_date: string | null
          name: string | null
          pitching: string | null
          pitching_id: string | null
          pm_tel: string | null
          project: string | null
          project_manager: string | null
          project_type: string | null
          project_type_id: string | null
          quo_head: string | null
          quotation_no: string | null
          quote_updated_name: string | null
          real_creator: string | null
          reference_number: string | null
          remark_under_section: string | null
          size: string | null
          slug: string | null
          status: string | null
          terms_and_conditions: string | null
          version_number: number | null
          work_address: string | null
        }
        Insert: {
          bubble_id?: string | null
          company_address?: string | null
          company_name?: string | null
          contact_person?: string | null
          contact_tel?: string | null
          contract_type?: string | null
          contract_type_id?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_id?: string | null
          date?: string | null
          discount_method?: string | null
          discount_percent?: number | null
          discount_type_p?: string | null
          email?: string | null
          fixed_discount?: number | null
          id?: string
          l_version?: string | null
          modified_date?: string | null
          name?: string | null
          pitching?: string | null
          pitching_id?: string | null
          pm_tel?: string | null
          project?: string | null
          project_manager?: string | null
          project_type?: string | null
          project_type_id?: string | null
          quo_head?: string | null
          quotation_no?: string | null
          quote_updated_name?: string | null
          real_creator?: string | null
          reference_number?: string | null
          remark_under_section?: string | null
          size?: string | null
          slug?: string | null
          status?: string | null
          terms_and_conditions?: string | null
          version_number?: number | null
          work_address?: string | null
        }
        Update: {
          bubble_id?: string | null
          company_address?: string | null
          company_name?: string | null
          contact_person?: string | null
          contact_tel?: string | null
          contract_type?: string | null
          contract_type_id?: string | null
          cost_centre_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_id?: string | null
          date?: string | null
          discount_method?: string | null
          discount_percent?: number | null
          discount_type_p?: string | null
          email?: string | null
          fixed_discount?: number | null
          id?: string
          l_version?: string | null
          modified_date?: string | null
          name?: string | null
          pitching?: string | null
          pitching_id?: string | null
          pm_tel?: string | null
          project?: string | null
          project_manager?: string | null
          project_type?: string | null
          project_type_id?: string | null
          quo_head?: string | null
          quotation_no?: string | null
          quote_updated_name?: string | null
          real_creator?: string | null
          reference_number?: string | null
          remark_under_section?: string | null
          size?: string | null
          slug?: string | null
          status?: string | null
          terms_and_conditions?: string | null
          version_number?: number | null
          work_address?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_quotations_contract_type_id"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "nos_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotations_cost_centre_id"
            columns: ["cost_centre_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotations_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotations_customer_id"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotations_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_quotations_project_type_id"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      receipts: {
        Row: {
          amount_received: number | null
          bubble_id: string | null
          cost_center_bu_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer_name: string | null
          enable_price_difference: boolean | null
          id: string
          income: string | null
          income_id: string | null
          invoice_id: string | null
          invoices: string | null
          modified_date: string | null
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          pdf_branding: Json | null
          price_difference: number | null
          price_difference_description: string | null
          project_name: string | null
          receipt_date: string | null
          slug: string | null
          system: string | null
        }
        Insert: {
          amount_received?: number | null
          bubble_id?: string | null
          cost_center_bu_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_name?: string | null
          enable_price_difference?: boolean | null
          id?: string
          income?: string | null
          income_id?: string | null
          invoice_id?: string | null
          invoices?: string | null
          modified_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          pdf_branding?: Json | null
          price_difference?: number | null
          price_difference_description?: string | null
          project_name?: string | null
          receipt_date?: string | null
          slug?: string | null
          system?: string | null
        }
        Update: {
          amount_received?: number | null
          bubble_id?: string | null
          cost_center_bu_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer_name?: string | null
          enable_price_difference?: boolean | null
          id?: string
          income?: string | null
          income_id?: string | null
          invoice_id?: string | null
          invoices?: string | null
          modified_date?: string | null
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          pdf_branding?: Json | null
          price_difference?: number | null
          price_difference_description?: string | null
          project_name?: string | null
          receipt_date?: string | null
          slug?: string | null
          system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_receipts_cost_center_bu_id"
            columns: ["cost_center_bu_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_receipts_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_receipts_income_id"
            columns: ["income_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_receipts_invoice_id"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "income_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          bubble_id: string | null
          contract_pdf: string | null
          created_by: string | null
          created_date: string | null
          expiry_date: string | null
          id: string
          modified_date: string | null
          number_of_installment: number | null
          project: string | null
          project_id: string | null
          r_incomes: string | null
          r_incomes_id: string | null
          slug: string | null
          start_date: string | null
          total_amount: number | null
        }
        Insert: {
          bubble_id?: string | null
          contract_pdf?: string | null
          created_by?: string | null
          created_date?: string | null
          expiry_date?: string | null
          id?: string
          modified_date?: string | null
          number_of_installment?: number | null
          project?: string | null
          project_id?: string | null
          r_incomes?: string | null
          r_incomes_id?: string | null
          slug?: string | null
          start_date?: string | null
          total_amount?: number | null
        }
        Update: {
          bubble_id?: string | null
          contract_pdf?: string | null
          created_by?: string | null
          created_date?: string | null
          expiry_date?: string | null
          id?: string
          modified_date?: string | null
          number_of_installment?: number | null
          project?: string | null
          project_id?: string | null
          r_incomes?: string | null
          r_incomes_id?: string | null
          slug?: string | null
          start_date?: string | null
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_recurring_incomes_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_recurring_incomes_r_incomes_id"
            columns: ["r_incomes_id"]
            isOneToOne: false
            referencedRelation: "incomes"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string | null
          display_name: string
          id: string
          level: number
          role_key: string
        }
        Insert: {
          created_at?: string | null
          display_name: string
          id?: string
          level?: number
          role_key: string
        }
        Update: {
          created_at?: string | null
          display_name?: string
          id?: string
          level?: number
          role_key?: string
        }
        Relationships: []
      }
      service_items: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_branding: boolean | null
          is_fast_build: boolean | null
          is_furniture: boolean | null
          is_material: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_branding?: boolean | null
          is_fast_build?: boolean | null
          is_furniture?: boolean | null
          is_material?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_branding?: boolean | null
          is_fast_build?: boolean | null
          is_furniture?: boolean | null
          is_material?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      service_types: {
        Row: {
          bubble_id: string | null
          chin_display: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          site_status_required: boolean
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          site_status_required?: boolean
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chin_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          site_status_required?: boolean
          slug?: string | null
        }
        Relationships: []
      }
      site_status_answers: {
        Row: {
          created_date: string
          id: string
          modified_date: string
          question_id: string
          site_status_id: string
          value: Json | null
        }
        Insert: {
          created_date?: string
          id?: string
          modified_date?: string
          question_id: string
          site_status_id: string
          value?: Json | null
        }
        Update: {
          created_date?: string
          id?: string
          modified_date?: string
          question_id?: string
          site_status_id?: string
          value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "site_status_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "site_status_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_status_answers_site_status_id_fkey"
            columns: ["site_status_id"]
            isOneToOne: false
            referencedRelation: "site_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      site_status_item_quantities: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          item: string | null
          item_display: string | null
          item_id: string | null
          modified_date: string | null
          os_service_area: string | null
          quantity: number | null
          question_type: string | null
          site_status_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item?: string | null
          item_display?: string | null
          item_id?: string | null
          modified_date?: string | null
          os_service_area?: string | null
          quantity?: number | null
          question_type?: string | null
          site_status_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          item?: string | null
          item_display?: string | null
          item_id?: string | null
          modified_date?: string | null
          os_service_area?: string | null
          quantity?: number | null
          question_type?: string | null
          site_status_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_site_status_item_quantities_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_site_status_item_quantities_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nos_site_status_items"
            referencedColumns: ["id"]
          },
        ]
      }
      site_status_question_options: {
        Row: {
          created_date: string
          id: string
          is_active: boolean
          label_en: string | null
          label_zh: string
          modified_date: string
          question_id: string
          sort_order: number
        }
        Insert: {
          created_date?: string
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_zh: string
          modified_date?: string
          question_id: string
          sort_order?: number
        }
        Update: {
          created_date?: string
          id?: string
          is_active?: boolean
          label_en?: string | null
          label_zh?: string
          modified_date?: string
          question_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_status_question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "site_status_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      site_status_question_project_types: {
        Row: {
          created_date: string
          id: string
          question_id: string
          quote_project_type_id: string
        }
        Insert: {
          created_date?: string
          id?: string
          question_id: string
          quote_project_type_id: string
        }
        Update: {
          created_date?: string
          id?: string
          question_id?: string
          quote_project_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_status_question_project_types_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "site_status_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_status_question_project_types_quote_project_type_id_fkey"
            columns: ["quote_project_type_id"]
            isOneToOne: false
            referencedRelation: "nos_quote_project_types"
            referencedColumns: ["id"]
          },
        ]
      }
      site_status_questions: {
        Row: {
          answer_type: string
          config: Json
          created_date: string
          id: string
          is_active: boolean
          is_required: boolean
          label_en: string | null
          label_zh: string
          modified_date: string
          section_id: string | null
          sort_order: number
        }
        Insert: {
          answer_type?: string
          config?: Json
          created_date?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label_en?: string | null
          label_zh: string
          modified_date?: string
          section_id?: string | null
          sort_order?: number
        }
        Update: {
          answer_type?: string
          config?: Json
          created_date?: string
          id?: string
          is_active?: boolean
          is_required?: boolean
          label_en?: string | null
          label_zh?: string
          modified_date?: string
          section_id?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "site_status_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "site_status_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      site_status_sections: {
        Row: {
          created_date: string
          icon: string | null
          id: string
          is_active: boolean
          modified_date: string
          sort_order: number
          title_en: string | null
          title_zh: string
        }
        Insert: {
          created_date?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          modified_date?: string
          sort_order?: number
          title_en?: string | null
          title_zh: string
        }
        Update: {
          created_date?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          modified_date?: string
          sort_order?: number
          title_en?: string | null
          title_zh?: string
        }
        Relationships: []
      }
      site_statuses: {
        Row: {
          ac1_status_b4: string | null
          ac2_types: string | null
          ac3_source: string | null
          ac4_other_service: string | null
          bubble_id: string | null
          c1_status_b4: string | null
          c2_material_b4: string | null
          c3_services: string | null
          c4_finishing_material: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          e1_status_b4: string | null
          e2_system_type: string | null
          e3_hardwares: string | null
          e4_monitors: string | null
          f1_status_b4: string | null
          f2_service_types: string | null
          f3_finishing_material: string | null
          f4_thickness: string | null
          f5_tiling_areas: string | null
          id: string
          modified_date: string | null
          o1_fitted_furnitures: string | null
          o2_certificate: string | null
          p1_status_b4: string | null
          p2_bmo_noise_control: string | null
          p3_service_needs: string | null
          p4_design_needs: string | null
          p5_tender_method: string | null
          pitching: string | null
          pitching_id: string | null
          project: string | null
          project_id: string | null
          r1_status_b4: string | null
          r2_room_quantities: string | null
          r3_pantry: string | null
          r4_partitions: string | null
          r5_fire_doors: string | null
          slug: string | null
          w1_status_b4: string | null
          w2_finishing_material: string | null
          w3_creative_walls: string | null
        }
        Insert: {
          ac1_status_b4?: string | null
          ac2_types?: string | null
          ac3_source?: string | null
          ac4_other_service?: string | null
          bubble_id?: string | null
          c1_status_b4?: string | null
          c2_material_b4?: string | null
          c3_services?: string | null
          c4_finishing_material?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          e1_status_b4?: string | null
          e2_system_type?: string | null
          e3_hardwares?: string | null
          e4_monitors?: string | null
          f1_status_b4?: string | null
          f2_service_types?: string | null
          f3_finishing_material?: string | null
          f4_thickness?: string | null
          f5_tiling_areas?: string | null
          id?: string
          modified_date?: string | null
          o1_fitted_furnitures?: string | null
          o2_certificate?: string | null
          p1_status_b4?: string | null
          p2_bmo_noise_control?: string | null
          p3_service_needs?: string | null
          p4_design_needs?: string | null
          p5_tender_method?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r1_status_b4?: string | null
          r2_room_quantities?: string | null
          r3_pantry?: string | null
          r4_partitions?: string | null
          r5_fire_doors?: string | null
          slug?: string | null
          w1_status_b4?: string | null
          w2_finishing_material?: string | null
          w3_creative_walls?: string | null
        }
        Update: {
          ac1_status_b4?: string | null
          ac2_types?: string | null
          ac3_source?: string | null
          ac4_other_service?: string | null
          bubble_id?: string | null
          c1_status_b4?: string | null
          c2_material_b4?: string | null
          c3_services?: string | null
          c4_finishing_material?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          e1_status_b4?: string | null
          e2_system_type?: string | null
          e3_hardwares?: string | null
          e4_monitors?: string | null
          f1_status_b4?: string | null
          f2_service_types?: string | null
          f3_finishing_material?: string | null
          f4_thickness?: string | null
          f5_tiling_areas?: string | null
          id?: string
          modified_date?: string | null
          o1_fitted_furnitures?: string | null
          o2_certificate?: string | null
          p1_status_b4?: string | null
          p2_bmo_noise_control?: string | null
          p3_service_needs?: string | null
          p4_design_needs?: string | null
          p5_tender_method?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r1_status_b4?: string | null
          r2_room_quantities?: string | null
          r3_pantry?: string | null
          r4_partitions?: string | null
          r5_fire_doors?: string | null
          slug?: string | null
          w1_status_b4?: string | null
          w2_finishing_material?: string | null
          w3_creative_walls?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_site_statuses_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_site_statuses_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_site_statuses_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_statuses_legacy_backup: {
        Row: {
          ac1_status_b4: string | null
          ac2_types: string | null
          ac3_source: string | null
          ac4_other_service: string | null
          bubble_id: string | null
          c1_status_b4: string | null
          c2_material_b4: string | null
          c3_services: string | null
          c4_finishing_material: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          e1_status_b4: string | null
          e2_system_type: string | null
          e3_hardwares: string | null
          e4_monitors: string | null
          f1_status_b4: string | null
          f2_service_types: string | null
          f3_finishing_material: string | null
          f4_thickness: string | null
          f5_tiling_areas: string | null
          id: string | null
          modified_date: string | null
          o1_fitted_furnitures: string | null
          o2_certificate: string | null
          p1_status_b4: string | null
          p2_bmo_noise_control: string | null
          p3_service_needs: string | null
          p4_design_needs: string | null
          p5_tender_method: string | null
          pitching: string | null
          pitching_id: string | null
          project: string | null
          project_id: string | null
          r1_status_b4: string | null
          r2_room_quantities: string | null
          r3_pantry: string | null
          r4_partitions: string | null
          r5_fire_doors: string | null
          slug: string | null
          w1_status_b4: string | null
          w2_finishing_material: string | null
          w3_creative_walls: string | null
        }
        Insert: {
          ac1_status_b4?: string | null
          ac2_types?: string | null
          ac3_source?: string | null
          ac4_other_service?: string | null
          bubble_id?: string | null
          c1_status_b4?: string | null
          c2_material_b4?: string | null
          c3_services?: string | null
          c4_finishing_material?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          e1_status_b4?: string | null
          e2_system_type?: string | null
          e3_hardwares?: string | null
          e4_monitors?: string | null
          f1_status_b4?: string | null
          f2_service_types?: string | null
          f3_finishing_material?: string | null
          f4_thickness?: string | null
          f5_tiling_areas?: string | null
          id?: string | null
          modified_date?: string | null
          o1_fitted_furnitures?: string | null
          o2_certificate?: string | null
          p1_status_b4?: string | null
          p2_bmo_noise_control?: string | null
          p3_service_needs?: string | null
          p4_design_needs?: string | null
          p5_tender_method?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r1_status_b4?: string | null
          r2_room_quantities?: string | null
          r3_pantry?: string | null
          r4_partitions?: string | null
          r5_fire_doors?: string | null
          slug?: string | null
          w1_status_b4?: string | null
          w2_finishing_material?: string | null
          w3_creative_walls?: string | null
        }
        Update: {
          ac1_status_b4?: string | null
          ac2_types?: string | null
          ac3_source?: string | null
          ac4_other_service?: string | null
          bubble_id?: string | null
          c1_status_b4?: string | null
          c2_material_b4?: string | null
          c3_services?: string | null
          c4_finishing_material?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          e1_status_b4?: string | null
          e2_system_type?: string | null
          e3_hardwares?: string | null
          e4_monitors?: string | null
          f1_status_b4?: string | null
          f2_service_types?: string | null
          f3_finishing_material?: string | null
          f4_thickness?: string | null
          f5_tiling_areas?: string | null
          id?: string | null
          modified_date?: string | null
          o1_fitted_furnitures?: string | null
          o2_certificate?: string | null
          p1_status_b4?: string | null
          p2_bmo_noise_control?: string | null
          p3_service_needs?: string | null
          p4_design_needs?: string | null
          p5_tender_method?: string | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r1_status_b4?: string | null
          r2_room_quantities?: string | null
          r3_pantry?: string | null
          r4_partitions?: string | null
          r5_fire_doors?: string | null
          slug?: string | null
          w1_status_b4?: string | null
          w2_finishing_material?: string | null
          w3_creative_walls?: string | null
        }
        Relationships: []
      }
      source_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      specific_rules: {
        Row: {
          condition_json: Json
          created_at: string | null
          description: string | null
          dimension: string
          dimension_value: string
          effect: string
          id: string
          is_active: boolean
          module: string
          priority: number
          rule_key: string
        }
        Insert: {
          condition_json?: Json
          created_at?: string | null
          description?: string | null
          dimension: string
          dimension_value: string
          effect: string
          id?: string
          is_active?: boolean
          module: string
          priority?: number
          rule_key: string
        }
        Update: {
          condition_json?: Json
          created_at?: string | null
          description?: string | null
          dimension?: string
          dimension_value?: string
          effect?: string
          id?: string
          is_active?: boolean
          module?: string
          priority?: number
          rule_key?: string
        }
        Relationships: []
      }
      staff: {
        Row: {
          bu: string | null
          bu_id: string | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          dual_system: boolean | null
          email: string | null
          entry_date: string | null
          full_name: string | null
          hit_rate: number | null
          id: string
          image: string | null
          member: string | null
          member_id: string | null
          modified_date: string | null
          n_team_type: string | null
          n_team_type_id: string | null
          name: string | null
          outstanding_alert_reset: boolean | null
          past_6_hit: number | null
          past_6_project: number | null
          past_6_quotation: number | null
          position: string | null
          private_phone: string | null
          project_number: number | null
          quotation_number: number | null
          quote_initial: string | null
          role: string | null
          slug: string | null
          status: string | null
          termination_date: string | null
          work_phone: string | null
        }
        Insert: {
          bu?: string | null
          bu_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          dual_system?: boolean | null
          email?: string | null
          entry_date?: string | null
          full_name?: string | null
          hit_rate?: number | null
          id?: string
          image?: string | null
          member?: string | null
          member_id?: string | null
          modified_date?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          name?: string | null
          outstanding_alert_reset?: boolean | null
          past_6_hit?: number | null
          past_6_project?: number | null
          past_6_quotation?: number | null
          position?: string | null
          private_phone?: string | null
          project_number?: number | null
          quotation_number?: number | null
          quote_initial?: string | null
          role?: string | null
          slug?: string | null
          status?: string | null
          termination_date?: string | null
          work_phone?: string | null
        }
        Update: {
          bu?: string | null
          bu_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          dual_system?: boolean | null
          email?: string | null
          entry_date?: string | null
          full_name?: string | null
          hit_rate?: number | null
          id?: string
          image?: string | null
          member?: string | null
          member_id?: string | null
          modified_date?: string | null
          n_team_type?: string | null
          n_team_type_id?: string | null
          name?: string | null
          outstanding_alert_reset?: boolean | null
          past_6_hit?: number | null
          past_6_project?: number | null
          past_6_quotation?: number | null
          position?: string | null
          private_phone?: string | null
          project_number?: number | null
          quotation_number?: number | null
          quote_initial?: string | null
          role?: string | null
          slug?: string | null
          status?: string | null
          termination_date?: string | null
          work_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_staff_bu_id"
            columns: ["bu_id"]
            isOneToOne: false
            referencedRelation: "cost_centres"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_staff_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_staff_n_team_type_id"
            columns: ["n_team_type_id"]
            isOneToOne: false
            referencedRelation: "team_types"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_bv_deductions: {
        Row: {
          created_by: string | null
          created_date: string | null
          deduction_bv: number
          id: string
          modified_date: string | null
          n_financial_year_id: string
          reason: string | null
          staff_id: string
        }
        Insert: {
          created_by?: string | null
          created_date?: string | null
          deduction_bv?: number
          id?: string
          modified_date?: string | null
          n_financial_year_id: string
          reason?: string | null
          staff_id: string
        }
        Update: {
          created_by?: string | null
          created_date?: string | null
          deduction_bv?: number
          id?: string
          modified_date?: string | null
          n_financial_year_id?: string
          reason?: string | null
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_bv_deductions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bv_deductions_n_financial_year_id_fkey"
            columns: ["n_financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_bv_deductions_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_supplier_comments: {
        Row: {
          bubble_id: string | null
          bwf_project: string | null
          bwf_project_id: string | null
          comment: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          evaluator: string | null
          evaluator_id: string | null
          factory: string | null
          factory_id: string | null
          id: string
          modified_date: string | null
          point: number | null
          project: string | null
          project_id: string | null
          rating_professional_skill: number | null
          rating_service_attitude: number | null
          rating_time_management: number | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          factory?: string | null
          factory_id?: string | null
          id?: string
          modified_date?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          rating_professional_skill?: number | null
          rating_service_attitude?: number | null
          rating_time_management?: number | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          bwf_project?: string | null
          bwf_project_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          evaluator?: string | null
          evaluator_id?: string | null
          factory?: string | null
          factory_id?: string | null
          id?: string
          modified_date?: string | null
          point?: number | null
          project?: string | null
          project_id?: string | null
          rating_professional_skill?: number | null
          rating_service_attitude?: number | null
          rating_time_management?: number | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ssc_bwf_project_id"
            columns: ["bwf_project_id"]
            isOneToOne: false
            referencedRelation: "bwf_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ssc_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ssc_evaluator_id"
            columns: ["evaluator_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ssc_factory_id"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ssc_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ssc_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_feedback: {
        Row: {
          bubble_id: string | null
          comment: string | null
          created_by: string | null
          created_date: string | null
          id: string
          member: string | null
          modified_date: string | null
          point: number | null
          slug: string | null
          supplier: string | null
          tender: string | null
        }
        Insert: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          member?: string | null
          modified_date?: string | null
          point?: number | null
          slug?: string | null
          supplier?: string | null
          tender?: string | null
        }
        Update: {
          bubble_id?: string | null
          comment?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          member?: string | null
          modified_date?: string | null
          point?: number | null
          slug?: string | null
          supplier?: string | null
          tender?: string | null
        }
        Relationships: []
      }
      supplier_file_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
          type: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          type?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          type?: string | null
        }
        Relationships: []
      }
      supplier_files: {
        Row: {
          bubble_id: string | null
          code_number: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          expiry_date: string | null
          file: string | null
          file_name: string | null
          id: string
          institution: string | null
          modified_date: string | null
          remarks: string | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
          type: string | null
          type_id: string | null
          type_name: string | null
        }
        Insert: {
          bubble_id?: string | null
          code_number?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          expiry_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          institution?: string | null
          modified_date?: string | null
          remarks?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          type?: string | null
          type_id?: string | null
          type_name?: string | null
        }
        Update: {
          bubble_id?: string | null
          code_number?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          expiry_date?: string | null
          file?: string | null
          file_name?: string | null
          id?: string
          institution?: string | null
          modified_date?: string | null
          remarks?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          type?: string | null
          type_id?: string | null
          type_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_files_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_files_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_files_type_id"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "supplier_file_types"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_level_pass_out_dates: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          day: number | null
          id: string
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          day?: number | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          day?: number | null
          id?: string
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      supplier_level_roles: {
        Row: {
          amount: number | null
          bubble_id: string | null
          count: number | null
          created_by: string | null
          created_date: string | null
          id: string
          level: string | null
          modified_date: string | null
          month: number | null
          point: number | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          count?: number | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          level?: string | null
          modified_date?: string | null
          month?: number | null
          point?: number | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          count?: number | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          level?: string | null
          modified_date?: string | null
          month?: number | null
          point?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      supplier_login_codes: {
        Row: {
          bubble_id: string | null
          code: string | null
          created_by: string | null
          created_date: string | null
          expiry_date: string | null
          id: string
          ip_address: string | null
          login_date: string | null
          modified_date: string | null
          slug: string | null
          status: string | null
          supplier: string | null
        }
        Insert: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_date?: string | null
          expiry_date?: string | null
          id?: string
          ip_address?: string | null
          login_date?: string | null
          modified_date?: string | null
          slug?: string | null
          status?: string | null
          supplier?: string | null
        }
        Update: {
          bubble_id?: string | null
          code?: string | null
          created_by?: string | null
          created_date?: string | null
          expiry_date?: string | null
          id?: string
          ip_address?: string | null
          login_date?: string | null
          modified_date?: string | null
          slug?: string | null
          status?: string | null
          supplier?: string | null
        }
        Relationships: []
      }
      supplier_pricings: {
        Row: {
          bubble_id: string | null
          chn_name: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          editor: string | null
          editor_id: string | null
          eng_name: string | null
          id: string
          item: string | null
          item_id: string | null
          item_unit_price: number | null
          modified_date: string | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
          unit: string | null
          unit_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          chn_name?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          editor?: string | null
          editor_id?: string | null
          eng_name?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          item_unit_price?: number | null
          modified_date?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          chn_name?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          editor?: string | null
          editor_id?: string | null
          eng_name?: string | null
          id?: string
          item?: string | null
          item_id?: string | null
          item_unit_price?: number | null
          modified_date?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          unit?: string | null
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_pricings_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_pricings_editor_id"
            columns: ["editor_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_pricings_item_id"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "nos_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_pricings_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_pricings_unit_id"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "nos_units"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_recent_statuses: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
          text: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          text?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_recent_statuses_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_recent_statuses_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_register_forms: {
        Row: {
          basic_profession: string | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          decorative_profession: string | null
          drawing_experience: string | null
          id: string
          job_mode: string | null
          mechanical_profession: string | null
          modified_date: string | null
          payment_style: string | null
          project_type: string | null
          site_target: string | null
          slug: string | null
          supplier: string | null
          supplier_id: string | null
        }
        Insert: {
          basic_profession?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          decorative_profession?: string | null
          drawing_experience?: string | null
          id?: string
          job_mode?: string | null
          mechanical_profession?: string | null
          modified_date?: string | null
          payment_style?: string | null
          project_type?: string | null
          site_target?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Update: {
          basic_profession?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          decorative_profession?: string | null
          drawing_experience?: string | null
          id?: string
          job_mode?: string | null
          mechanical_profession?: string | null
          modified_date?: string | null
          payment_style?: string | null
          project_type?: string | null
          site_target?: string | null
          slug?: string | null
          supplier?: string | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_supplier_register_forms_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_supplier_register_forms_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_rule_displays: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          dropdown_a: string | null
          dropdown_b: string | null
          dropdown_c: string | null
          id: string
          level: string | null
          modified_date: string | null
          show_b: boolean | null
          show_c: boolean | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          dropdown_a?: string | null
          dropdown_b?: string | null
          dropdown_c?: string | null
          id?: string
          level?: string | null
          modified_date?: string | null
          show_b?: boolean | null
          show_c?: boolean | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          dropdown_a?: string | null
          dropdown_b?: string | null
          dropdown_c?: string | null
          id?: string
          level?: string | null
          modified_date?: string | null
          show_b?: boolean | null
          show_c?: boolean | null
          slug?: string | null
        }
        Relationships: []
      }
      supplier_supplier_tags: {
        Row: {
          created_at: string | null
          id: string
          supplier_id: string
          supplier_tag_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          supplier_id: string
          supplier_tag_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          supplier_id?: string
          supplier_tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sst_tags_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sst_tags_supplier_tag_id"
            columns: ["supplier_tag_id"]
            isOneToOne: false
            referencedRelation: "nos_supplier_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_supplier_types: {
        Row: {
          created_at: string | null
          id: string
          supplier_id: string
          supplier_type_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          supplier_id: string
          supplier_type_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          supplier_id?: string
          supplier_type_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_sst_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_sst_supplier_type_id"
            columns: ["supplier_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_types: {
        Row: {
          bubble_id: string | null
          chinese_display: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_active: boolean
          is_bwf: boolean | null
          modified_date: string | null
          order: number | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean
          is_bwf?: boolean | null
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          chinese_display?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean
          is_bwf?: boolean | null
          modified_date?: string | null
          order?: number | null
          slug?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          account_description: string | null
          account_status: string | null
          address: string | null
          admin_level: string | null
          amount: number | null
          asana_link: string | null
          auto_level: string | null
          bubble_id: string | null
          chinese_name: string | null
          company_office_photo: string | null
          contact_persons: string | null
          contact1_chn_given_name: string | null
          contact1_chn_nickname: string | null
          contact1_chn_surname: string | null
          contact1_eng_givenname: string | null
          contact1_eng_nickname: string | null
          contact1_eng_surname: string | null
          contact1_gender: string | null
          contact1_job_title: string | null
          contact1_name_card: string | null
          contact1_phone: string | null
          contact2_chn_given_name: string | null
          contact2_chn_nickname: string | null
          contact2_chn_surname: string | null
          contact2_eng_givenname: string | null
          contact2_eng_nickname: string | null
          contact2_eng_surname: string | null
          contact2_gender: string | null
          contact2_job_title: string | null
          contact2_name_card: string | null
          contact2_phone: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          director_hkid: string | null
          disable_comments: boolean | null
          display_name: string | null
          district: string | null
          district_id: string | null
          email: string | null
          establish_year: string | null
          expense: string | null
          fax_no: string | null
          id: string
          join_date: string | null
          level_modified_date: string | null
          level_pass_out_day: string | null
          modified_date: string | null
          moq: string | null
          n_type: string | null
          n_type_id: string | null
          name: string | null
          order_days: string | null
          outstanding: number | null
          paid: number | null
          past_12_project: number | null
          past_6_project: number | null
          past12_count: number | null
          phone: string | null
          professional_skill: string | null
          project: string | null
          project_number: number | null
          real_level: string | null
          referer_name: string | null
          referer_set: string | null
          register_form: string | null
          related_file: string | null
          remark: string | null
          slug: string | null
          sort_type: string | null
          status: string | null
          supplier_tags: string | null
          website: string | null
        }
        Insert: {
          account_description?: string | null
          account_status?: string | null
          address?: string | null
          admin_level?: string | null
          amount?: number | null
          asana_link?: string | null
          auto_level?: string | null
          bubble_id?: string | null
          chinese_name?: string | null
          company_office_photo?: string | null
          contact_persons?: string | null
          contact1_chn_given_name?: string | null
          contact1_chn_nickname?: string | null
          contact1_chn_surname?: string | null
          contact1_eng_givenname?: string | null
          contact1_eng_nickname?: string | null
          contact1_eng_surname?: string | null
          contact1_gender?: string | null
          contact1_job_title?: string | null
          contact1_name_card?: string | null
          contact1_phone?: string | null
          contact2_chn_given_name?: string | null
          contact2_chn_nickname?: string | null
          contact2_chn_surname?: string | null
          contact2_eng_givenname?: string | null
          contact2_eng_nickname?: string | null
          contact2_eng_surname?: string | null
          contact2_gender?: string | null
          contact2_job_title?: string | null
          contact2_name_card?: string | null
          contact2_phone?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          director_hkid?: string | null
          disable_comments?: boolean | null
          display_name?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          establish_year?: string | null
          expense?: string | null
          fax_no?: string | null
          id?: string
          join_date?: string | null
          level_modified_date?: string | null
          level_pass_out_day?: string | null
          modified_date?: string | null
          moq?: string | null
          n_type?: string | null
          n_type_id?: string | null
          name?: string | null
          order_days?: string | null
          outstanding?: number | null
          paid?: number | null
          past_12_project?: number | null
          past_6_project?: number | null
          past12_count?: number | null
          phone?: string | null
          professional_skill?: string | null
          project?: string | null
          project_number?: number | null
          real_level?: string | null
          referer_name?: string | null
          referer_set?: string | null
          register_form?: string | null
          related_file?: string | null
          remark?: string | null
          slug?: string | null
          sort_type?: string | null
          status?: string | null
          supplier_tags?: string | null
          website?: string | null
        }
        Update: {
          account_description?: string | null
          account_status?: string | null
          address?: string | null
          admin_level?: string | null
          amount?: number | null
          asana_link?: string | null
          auto_level?: string | null
          bubble_id?: string | null
          chinese_name?: string | null
          company_office_photo?: string | null
          contact_persons?: string | null
          contact1_chn_given_name?: string | null
          contact1_chn_nickname?: string | null
          contact1_chn_surname?: string | null
          contact1_eng_givenname?: string | null
          contact1_eng_nickname?: string | null
          contact1_eng_surname?: string | null
          contact1_gender?: string | null
          contact1_job_title?: string | null
          contact1_name_card?: string | null
          contact1_phone?: string | null
          contact2_chn_given_name?: string | null
          contact2_chn_nickname?: string | null
          contact2_chn_surname?: string | null
          contact2_eng_givenname?: string | null
          contact2_eng_nickname?: string | null
          contact2_eng_surname?: string | null
          contact2_gender?: string | null
          contact2_job_title?: string | null
          contact2_name_card?: string | null
          contact2_phone?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          director_hkid?: string | null
          disable_comments?: boolean | null
          display_name?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          establish_year?: string | null
          expense?: string | null
          fax_no?: string | null
          id?: string
          join_date?: string | null
          level_modified_date?: string | null
          level_pass_out_day?: string | null
          modified_date?: string | null
          moq?: string | null
          n_type?: string | null
          n_type_id?: string | null
          name?: string | null
          order_days?: string | null
          outstanding?: number | null
          paid?: number | null
          past_12_project?: number | null
          past_6_project?: number | null
          past12_count?: number | null
          phone?: string | null
          professional_skill?: string | null
          project?: string | null
          project_number?: number | null
          real_level?: string | null
          referer_name?: string | null
          referer_set?: string | null
          register_form?: string | null
          related_file?: string | null
          remark?: string | null
          slug?: string | null
          sort_type?: string | null
          status?: string | null
          supplier_tags?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_suppliers_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_suppliers_district_id"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_suppliers_n_type_id"
            columns: ["n_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
        ]
      }
      target_sales: {
        Row: {
          amount: number | null
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          financial_year: string | null
          financial_year_id: string | null
          gross_profit: number | null
          id: string
          modified_date: string | null
          sales: number | null
          slug: string | null
        }
        Insert: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          financial_year?: string | null
          financial_year_id?: string | null
          gross_profit?: number | null
          id?: string
          modified_date?: string | null
          sales?: number | null
          slug?: string | null
        }
        Update: {
          amount?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          financial_year?: string | null
          financial_year_id?: string | null
          gross_profit?: number | null
          id?: string
          modified_date?: string | null
          sales?: number | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_target_sales_financial_year_id"
            columns: ["financial_year_id"]
            isOneToOne: false
            referencedRelation: "financial_years"
            referencedColumns: ["id"]
          },
        ]
      }
      team_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          display: string | null
          id: string
          is_active: boolean
          is_bwf: boolean | null
          modified_date: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          display?: string | null
          id?: string
          is_active?: boolean
          is_bwf?: boolean | null
          modified_date?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      tender_bids: {
        Row: {
          bid_price: number | null
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          final_price: number | null
          id: string
          modified_date: string | null
          pdf_file: string | null
          rating_attitude: number | null
          rating_communication: number | null
          rating_cost: number | null
          rating_design: number | null
          rating_overall: number | null
          rating_past_coop: number | null
          rating_past_experience: number | null
          rating_qualification: number | null
          rating_time_consumption: number | null
          slug: string | null
          staff_internal_reason: string | null
          staff_short_respond: string | null
          status: string | null
          submission_date: string | null
          supplier: string | null
          tender: string | null
          tender_deadline: string | null
          witness: string | null
          witness_id: string | null
        }
        Insert: {
          bid_price?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          final_price?: number | null
          id?: string
          modified_date?: string | null
          pdf_file?: string | null
          rating_attitude?: number | null
          rating_communication?: number | null
          rating_cost?: number | null
          rating_design?: number | null
          rating_overall?: number | null
          rating_past_coop?: number | null
          rating_past_experience?: number | null
          rating_qualification?: number | null
          rating_time_consumption?: number | null
          slug?: string | null
          staff_internal_reason?: string | null
          staff_short_respond?: string | null
          status?: string | null
          submission_date?: string | null
          supplier?: string | null
          tender?: string | null
          tender_deadline?: string | null
          witness?: string | null
          witness_id?: string | null
        }
        Update: {
          bid_price?: number | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          final_price?: number | null
          id?: string
          modified_date?: string | null
          pdf_file?: string | null
          rating_attitude?: number | null
          rating_communication?: number | null
          rating_cost?: number | null
          rating_design?: number | null
          rating_overall?: number | null
          rating_past_coop?: number | null
          rating_past_experience?: number | null
          rating_qualification?: number | null
          rating_time_consumption?: number | null
          slug?: string | null
          staff_internal_reason?: string | null
          staff_short_respond?: string | null
          status?: string | null
          submission_date?: string | null
          supplier?: string | null
          tender?: string | null
          tender_deadline?: string | null
          witness?: string | null
          witness_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tender_bids_witness_id"
            columns: ["witness_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_message_bids: {
        Row: {
          bid_id: string | null
          id: string
          message_id: string | null
        }
        Insert: {
          bid_id?: string | null
          id?: string
          message_id?: string | null
        }
        Update: {
          bid_id?: string | null
          id?: string
          message_id?: string | null
        }
        Relationships: []
      }
      tender_message_receivers: {
        Row: {
          id: string
          message_id: string | null
          receiver_id: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          receiver_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          receiver_id?: string | null
        }
        Relationships: []
      }
      tender_message_seen: {
        Row: {
          id: string
          message_id: string | null
          seen_id: string | null
        }
        Insert: {
          id?: string
          message_id?: string | null
          seen_id?: string | null
        }
        Update: {
          id?: string
          message_id?: string | null
          seen_id?: string | null
        }
        Relationships: []
      }
      tender_messages: {
        Row: {
          attachment: string | null
          bids: string | null
          bids_id: string | null
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          message: string | null
          modified_date: string | null
          receiver_list: string | null
          receiver_type: string | null
          removed: boolean | null
          reply_to: string | null
          reply_to_id: string | null
          seen_list: string | null
          sender_name: string | null
          sender_type: string | null
          slug: string | null
          tender: string | null
          type: string | null
        }
        Insert: {
          attachment?: string | null
          bids?: string | null
          bids_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          message?: string | null
          modified_date?: string | null
          receiver_list?: string | null
          receiver_type?: string | null
          removed?: boolean | null
          reply_to?: string | null
          reply_to_id?: string | null
          seen_list?: string | null
          sender_name?: string | null
          sender_type?: string | null
          slug?: string | null
          tender?: string | null
          type?: string | null
        }
        Update: {
          attachment?: string | null
          bids?: string | null
          bids_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          message?: string | null
          modified_date?: string | null
          receiver_list?: string | null
          receiver_type?: string | null
          removed?: boolean | null
          reply_to?: string | null
          reply_to_id?: string | null
          seen_list?: string | null
          sender_name?: string | null
          sender_type?: string | null
          slug?: string | null
          tender?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tender_messages_bids_id"
            columns: ["bids_id"]
            isOneToOne: false
            referencedRelation: "tender_bids"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tender_messages_reply_to_id"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "tender_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_rejected_suppliers: {
        Row: {
          id: string
          supplier_id: string | null
          tender_id: string | null
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          tender_id?: string | null
        }
        Update: {
          id?: string
          supplier_id?: string | null
          tender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_rejected_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      tender_responds: {
        Row: {
          briefing_date_change: string | null
          briefing_participant_count: number | null
          briefing_session_reply: string | null
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          id: string
          modified_date: string | null
          respond: string | null
          site_visit_date_change: string | null
          site_visit_participant_count: number | null
          site_visit_reply: string | null
          slug: string | null
          supplier: string | null
          tender: string | null
          tender_respond_type: string | null
        }
        Insert: {
          briefing_date_change?: string | null
          briefing_participant_count?: number | null
          briefing_session_reply?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          respond?: string | null
          site_visit_date_change?: string | null
          site_visit_participant_count?: number | null
          site_visit_reply?: string | null
          slug?: string | null
          supplier?: string | null
          tender?: string | null
          tender_respond_type?: string | null
        }
        Update: {
          briefing_date_change?: string | null
          briefing_participant_count?: number | null
          briefing_session_reply?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          id?: string
          modified_date?: string | null
          respond?: string | null
          site_visit_date_change?: string | null
          site_visit_participant_count?: number | null
          site_visit_reply?: string | null
          slug?: string | null
          supplier?: string | null
          tender?: string | null
          tender_respond_type?: string | null
        }
        Relationships: []
      }
      tender_seen: {
        Row: {
          id: string
          seen_id: string | null
          tender_id: string | null
        }
        Insert: {
          id?: string
          seen_id?: string | null
          tender_id?: string | null
        }
        Update: {
          id?: string
          seen_id?: string | null
          tender_id?: string | null
        }
        Relationships: []
      }
      tender_selective_suppliers: {
        Row: {
          id: string
          supplier_id: string | null
          tender_id: string | null
        }
        Insert: {
          id?: string
          supplier_id?: string | null
          tender_id?: string | null
        }
        Update: {
          id?: string
          supplier_id?: string | null
          tender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tender_selective_suppliers_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      tenders: {
        Row: {
          additional_information: string | null
          briefing_session_date: string | null
          briefing_session_location: string | null
          bubble_id: string | null
          budget: number | null
          bwf_pitching: string | null
          bwf_project: string | null
          created_by: string | null
          created_date: string | null
          drawing_designer: string | null
          drawing_designer_id: string | null
          dropbox_link: string | null
          est_end_date: string | null
          est_start_date: string | null
          files: string | null
          id: string
          image_1: string | null
          image_2: string | null
          image_3: string | null
          modified_date: string | null
          pdf_requirement: string | null
          pitching: string | null
          project: string | null
          project_description: string | null
          project_type: string | null
          project_type_id: string | null
          rating_attitude_pct: number | null
          rating_communication_pct: number | null
          rating_cost_pct: number | null
          rating_design_pct: number | null
          rating_past_coop_pct: number | null
          rating_past_experience_pct: number | null
          rating_qualification_pct: number | null
          rating_time_consumption_pct: number | null
          rejected_supplier: string | null
          seen_list: string | null
          selective_supplier: string | null
          site_visit_date: string | null
          slug: string | null
          supplier_type: string | null
          supplier_type_id: string | null
          tender_code: string | null
          tender_deadline: string | null
          tender_deadline_b4_extend: string | null
          tender_name: string | null
          tender_type: string | null
        }
        Insert: {
          additional_information?: string | null
          briefing_session_date?: string | null
          briefing_session_location?: string | null
          bubble_id?: string | null
          budget?: number | null
          bwf_pitching?: string | null
          bwf_project?: string | null
          created_by?: string | null
          created_date?: string | null
          drawing_designer?: string | null
          drawing_designer_id?: string | null
          dropbox_link?: string | null
          est_end_date?: string | null
          est_start_date?: string | null
          files?: string | null
          id?: string
          image_1?: string | null
          image_2?: string | null
          image_3?: string | null
          modified_date?: string | null
          pdf_requirement?: string | null
          pitching?: string | null
          project?: string | null
          project_description?: string | null
          project_type?: string | null
          project_type_id?: string | null
          rating_attitude_pct?: number | null
          rating_communication_pct?: number | null
          rating_cost_pct?: number | null
          rating_design_pct?: number | null
          rating_past_coop_pct?: number | null
          rating_past_experience_pct?: number | null
          rating_qualification_pct?: number | null
          rating_time_consumption_pct?: number | null
          rejected_supplier?: string | null
          seen_list?: string | null
          selective_supplier?: string | null
          site_visit_date?: string | null
          slug?: string | null
          supplier_type?: string | null
          supplier_type_id?: string | null
          tender_code?: string | null
          tender_deadline?: string | null
          tender_deadline_b4_extend?: string | null
          tender_name?: string | null
          tender_type?: string | null
        }
        Update: {
          additional_information?: string | null
          briefing_session_date?: string | null
          briefing_session_location?: string | null
          bubble_id?: string | null
          budget?: number | null
          bwf_pitching?: string | null
          bwf_project?: string | null
          created_by?: string | null
          created_date?: string | null
          drawing_designer?: string | null
          drawing_designer_id?: string | null
          dropbox_link?: string | null
          est_end_date?: string | null
          est_start_date?: string | null
          files?: string | null
          id?: string
          image_1?: string | null
          image_2?: string | null
          image_3?: string | null
          modified_date?: string | null
          pdf_requirement?: string | null
          pitching?: string | null
          project?: string | null
          project_description?: string | null
          project_type?: string | null
          project_type_id?: string | null
          rating_attitude_pct?: number | null
          rating_communication_pct?: number | null
          rating_cost_pct?: number | null
          rating_design_pct?: number | null
          rating_past_coop_pct?: number | null
          rating_past_experience_pct?: number | null
          rating_qualification_pct?: number | null
          rating_time_consumption_pct?: number | null
          rejected_supplier?: string | null
          seen_list?: string | null
          selective_supplier?: string | null
          site_visit_date?: string | null
          slug?: string | null
          supplier_type?: string | null
          supplier_type_id?: string | null
          tender_code?: string | null
          tender_deadline?: string | null
          tender_deadline_b4_extend?: string | null
          tender_name?: string | null
          tender_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_tenders_drawing_designer_id"
            columns: ["drawing_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tenders_project_type_id"
            columns: ["project_type_id"]
            isOneToOne: false
            referencedRelation: "project_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_tenders_supplier_type_id"
            columns: ["supplier_type_id"]
            isOneToOne: false
            referencedRelation: "supplier_types"
            referencedColumns: ["id"]
          },
        ]
      }
      term_template_section_details: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          description: string | null
          id: string
          modified_date: string | null
          number: string | null
          order: number | null
          slug: string | null
          star: boolean | null
          template_name: string | null
          template_name_id: string | null
          template_section: string | null
          template_section_id: string | null
          term_head: string | null
          total: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          modified_date?: string | null
          number?: string | null
          order?: number | null
          slug?: string | null
          star?: boolean | null
          template_name?: string | null
          template_name_id?: string | null
          template_section?: string | null
          template_section_id?: string | null
          term_head?: string | null
          total?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          description?: string | null
          id?: string
          modified_date?: string | null
          number?: string | null
          order?: number | null
          slug?: string | null
          star?: boolean | null
          template_name?: string | null
          template_name_id?: string | null
          template_section?: string | null
          template_section_id?: string | null
          term_head?: string | null
          total?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_term_template_section_details_template_name_id"
            columns: ["template_name_id"]
            isOneToOne: false
            referencedRelation: "term_template_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_term_template_section_details_template_section_id"
            columns: ["template_section_id"]
            isOneToOne: false
            referencedRelation: "term_template_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      term_template_sections: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          head_name: string | null
          id: string
          modified_date: string | null
          order: number | null
          slug: string | null
          template_name: string | null
          template_name_id: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          head_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
          template_name?: string | null
          template_name_id?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          head_name?: string | null
          id?: string
          modified_date?: string | null
          order?: number | null
          slug?: string | null
          template_name?: string | null
          template_name_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_term_template_sections_template_name_id"
            columns: ["template_name_id"]
            isOneToOne: false
            referencedRelation: "term_template_types"
            referencedColumns: ["id"]
          },
        ]
      }
      term_template_types: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_date: string | null
          default_chi: string | null
          default_eng: string | null
          id: string
          lan: string | null
          modified_date: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          default_chi?: string | null
          default_eng?: string | null
          id?: string
          lan?: string | null
          modified_date?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_date?: string | null
          default_chi?: string | null
          default_eng?: string | null
          id?: string
          lan?: string | null
          modified_date?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      three_d_collection_liked_staff: {
        Row: {
          collection_id: string | null
          id: string
          staff_id: string | null
        }
        Insert: {
          collection_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Update: {
          collection_id?: string | null
          id?: string
          staff_id?: string | null
        }
        Relationships: []
      }
      three_d_collections: {
        Row: {
          bubble_id: string | null
          collab_designer: string | null
          collab_designer_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          description: string | null
          display_name: string | null
          id: string
          liked_staff: string | null
          likes_count: number | null
          main_designer: string | null
          main_designer_id: string | null
          modified_date: string | null
          o_3d_status: string | null
          r_pitching: string | null
          r_pitching_id: string | null
          r_project: string | null
          r_project_id: string | null
          real_created_date: string | null
          slug: string | null
          tags: string | null
          version_number: number | null
        }
        Insert: {
          bubble_id?: string | null
          collab_designer?: string | null
          collab_designer_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          liked_staff?: string | null
          likes_count?: number | null
          main_designer?: string | null
          main_designer_id?: string | null
          modified_date?: string | null
          o_3d_status?: string | null
          r_pitching?: string | null
          r_pitching_id?: string | null
          r_project?: string | null
          r_project_id?: string | null
          real_created_date?: string | null
          slug?: string | null
          tags?: string | null
          version_number?: number | null
        }
        Update: {
          bubble_id?: string | null
          collab_designer?: string | null
          collab_designer_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          description?: string | null
          display_name?: string | null
          id?: string
          liked_staff?: string | null
          likes_count?: number | null
          main_designer?: string | null
          main_designer_id?: string | null
          modified_date?: string | null
          o_3d_status?: string | null
          r_pitching?: string | null
          r_pitching_id?: string | null
          r_project?: string | null
          r_project_id?: string | null
          real_created_date?: string | null
          slug?: string | null
          tags?: string | null
          version_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_three_d_collections_collab_designer_id"
            columns: ["collab_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_collections_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_collections_main_designer_id"
            columns: ["main_designer_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_collections_r_pitching_id"
            columns: ["r_pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_collections_r_project_id"
            columns: ["r_project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      three_d_renders: {
        Row: {
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          id: string
          image: string | null
          modified_date: string | null
          order: number | null
          pitching: string | null
          pitching_id: string | null
          project: string | null
          project_id: string | null
          r_3d_collection: string | null
          r_3d_collection_id: string | null
          slug: string | null
        }
        Insert: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          image?: string | null
          modified_date?: string | null
          order?: number | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r_3d_collection?: string | null
          r_3d_collection_id?: string | null
          slug?: string | null
        }
        Update: {
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          id?: string
          image?: string | null
          modified_date?: string | null
          order?: number | null
          pitching?: string | null
          pitching_id?: string | null
          project?: string | null
          project_id?: string | null
          r_3d_collection?: string | null
          r_3d_collection_id?: string | null
          slug?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_three_d_renders_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_renders_pitching_id"
            columns: ["pitching_id"]
            isOneToOne: false
            referencedRelation: "bwa_pitchings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_renders_project_id"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "bwa_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_three_d_renders_r_3d_collection_id"
            columns: ["r_3d_collection_id"]
            isOneToOne: false
            referencedRelation: "three_d_collections"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          approval_status: string
          auth_user_id: string | null
          bubble_id: string | null
          created_by: string | null
          created_by_id: string | null
          created_date: string | null
          customer: string | null
          customer_id: string | null
          email: string | null
          id: string
          ip: string | null
          is_developer: boolean
          last_login_at: string | null
          member: string | null
          member_id: string | null
          modified_date: string | null
          slug: string | null
          special: string | null
          supplier: string | null
          supplier_id: string | null
          two_fa_code: string | null
          user_type: string | null
          view_system: string | null
        }
        Insert: {
          approval_status?: string
          auth_user_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          is_developer?: boolean
          last_login_at?: string | null
          member?: string | null
          member_id?: string | null
          modified_date?: string | null
          slug?: string | null
          special?: string | null
          supplier?: string | null
          supplier_id?: string | null
          two_fa_code?: string | null
          user_type?: string | null
          view_system?: string | null
        }
        Update: {
          approval_status?: string
          auth_user_id?: string | null
          bubble_id?: string | null
          created_by?: string | null
          created_by_id?: string | null
          created_date?: string | null
          customer?: string | null
          customer_id?: string | null
          email?: string | null
          id?: string
          ip?: string | null
          is_developer?: boolean
          last_login_at?: string | null
          member?: string | null
          member_id?: string | null
          modified_date?: string | null
          slug?: string | null
          special?: string | null
          supplier?: string | null
          supplier_id?: string | null
          two_fa_code?: string | null
          user_type?: string | null
          view_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_users_created_by_id"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_users_member_id"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "staff"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_users_supplier_id"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auto_close_stale_pitchings: {
        Args: { p_deadline_days?: number }
        Returns: number
      }
      check_permission: {
        Args: { p_action: string; p_module: string; p_user_id: string }
        Returns: boolean
      }
      check_specific_rule: {
        Args: {
          p_context?: Json
          p_module: string
          p_rule_key: string
          p_user_id: string
        }
        Returns: string
      }
      compute_bwa_os_schedule_group: {
        Args: { p_estimated_income: number; p_service_type_id: string }
        Returns: string
      }
      exec_sql: { Args: { sql_query: string }; Returns: undefined }
      explain_permission_resolution: {
        Args: { p_action?: string; p_module: string; p_user_id: string }
        Returns: {
          assignment_effect: string
          assignment_priority: number
          dimension: string
          dimension_label: string
          dimension_rank: number
          is_winner: boolean
          layer_order: number
          resolved_allowed: boolean
          resolved_effect: string
          staff_value: string
          staff_value_label: string
        }[]
      }
      get_bwa_project_financials: {
        Args: { p_project_ids: string[] }
        Returns: {
          paid_expense: number
          paid_sales: number
          project_id: string
          total_expense: number
          total_sales: number
        }[]
      }
      get_bwf_project_financials: {
        Args: { p_project_ids: string[] }
        Returns: {
          income_payment_status: string
          paid_expense: number
          paid_sales: number
          project_id: string
          total_expense: number
          total_sales: number
        }[]
      }
      get_complete_user_context: {
        Args: { input_email: string }
        Returns: {
          display_name: string
          profile_data: Json
          staff_data: Json
        }[]
      }
      get_pms_auth_sessions: {
        Args: never
        Returns: {
          auth_user_id: string
          ip: string
          last_active_at: string
          login_at: string
          session_id: string
          user_agent: string
        }[]
      }
      get_table_columns_audit: {
        Args: never
        Returns: {
          column_default: string
          column_name: string
          data_type: string
          fk_target_column: string
          fk_target_table: string
          has_fk_constraint: boolean
          has_unique_constraint: boolean
          is_nullable: string
          table_name: string
        }[]
      }
      get_user_effective_permissions: {
        Args: { p_user_id: string }
        Returns: {
          action: string
          effect: string
          module: string
        }[]
      }
      get_module_view_roster: {
        Args: { p_module: string; p_action?: string }
        Returns: {
          staff_id: string
          staff_name: string
          role: string | null
          bu_id: string | null
          n_team_type_id: string | null
          position: string | null
          can_view: boolean
          decided_by: string
        }[]
      }
      get_modules_view_summary: {
        Args: { p_modules: string[]; p_action?: string }
        Returns: {
          module: string
          can_view_count: number
          cannot_view_count: number
        }[]
      }
      purge_stale_pms_auth_sessions: {
        Args: { p_max_age_days?: number }
        Returns: number
      }
      recalculate_all_customer_stats: { Args: never; Returns: undefined }
      recalculate_all_project_bv: { Args: never; Returns: number }
      recalculate_customer_stats: {
        Args: { p_customer_id: string }
        Returns: undefined
      }
      recalculate_project_bv: {
        Args: { p_project_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
