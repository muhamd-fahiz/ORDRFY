export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_log: {
        Row: {
          actor_user_id: string | null
          business_id: string
          contact_id: string | null
          created_at: string
          event_detail: Json | null
          event_type: string
          id: string
        }
        Insert: {
          actor_user_id?: string | null
          business_id: string
          contact_id?: string | null
          created_at?: string
          event_detail?: Json | null
          event_type: string
          id?: string
        }
        Update: {
          actor_user_id?: string | null
          business_id?: string
          contact_id?: string | null
          created_at?: string
          event_detail?: Json | null
          event_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_log_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          id: string
          mfa_required: boolean
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          mfa_required?: boolean
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          mfa_required?: boolean
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      business_channel_connections: {
        Row: {
          business_id: string
          channel_id: string
          connected: boolean
          created_at: string
          credentials_ref: string | null
          current_tier: string | null
          disconnected_at: string | null
          id: string
          provider_account_id: string | null
          tier_last_synced_at: string | null
          tier_usage_today: number | null
        }
        Insert: {
          business_id: string
          channel_id: string
          connected?: boolean
          created_at?: string
          credentials_ref?: string | null
          current_tier?: string | null
          disconnected_at?: string | null
          id?: string
          provider_account_id?: string | null
          tier_last_synced_at?: string | null
          tier_usage_today?: number | null
        }
        Update: {
          business_id?: string
          channel_id?: string
          connected?: boolean
          created_at?: string
          credentials_ref?: string | null
          current_tier?: string | null
          disconnected_at?: string | null
          id?: string
          provider_account_id?: string | null
          tier_last_synced_at?: string | null
          tier_usage_today?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "business_channel_connections_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_channel_connections_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      business_entitlements: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          entitlement_key: string
          id: string
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          entitlement_key: string
          id?: string
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          entitlement_key?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_entitlements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_memberships: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_memberships_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          business_id: string
          id: string
          setting_key: string
          setting_value: string | null
        }
        Insert: {
          business_id: string
          id?: string
          setting_key: string
          setting_value?: string | null
        }
        Update: {
          business_id?: string
          id?: string
          setting_key?: string
          setting_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          automation_paused: boolean
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          preferred_language: string
          subscription_status: string
          timezone: string
          trial_ends_at: string | null
          vertical: string
        }
        Insert: {
          automation_paused?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          preferred_language?: string
          subscription_status?: string
          timezone?: string
          trial_ends_at?: string | null
          vertical: string
        }
        Update: {
          automation_paused?: boolean
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          preferred_language?: string
          subscription_status?: string
          timezone?: string
          trial_ends_at?: string | null
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_vertical_fkey"
            columns: ["vertical"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      channels: {
        Row: {
          active: boolean
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          id?: string
          name?: string
        }
        Relationships: []
      }
      contact_channel_identities: {
        Row: {
          business_id: string
          channel_id: string
          contact_id: string
          created_at: string
          display_handle: string | null
          id: string
          last_inbound_at: string | null
          opted_out_at: string | null
          phone_number: string | null
          provider_metadata: Json | null
          provider_user_id: string
        }
        Insert: {
          business_id: string
          channel_id: string
          contact_id: string
          created_at?: string
          display_handle?: string | null
          id?: string
          last_inbound_at?: string | null
          opted_out_at?: string | null
          phone_number?: string | null
          provider_metadata?: Json | null
          provider_user_id: string
        }
        Update: {
          business_id?: string
          channel_id?: string
          contact_id?: string
          created_at?: string
          display_handle?: string | null
          id?: string
          last_inbound_at?: string | null
          opted_out_at?: string | null
          phone_number?: string | null
          provider_metadata?: Json | null
          provider_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_channel_identities_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_channel_identities_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_channel_identities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          business_id: string
          created_at: string
          id: string
          is_high_priority: boolean
          last_inbound_at: string | null
          last_outbound_at: string | null
          name: string | null
          pipeline_stage_id: string | null
          updated_at: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          is_high_priority?: boolean
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          name?: string | null
          pipeline_stage_id?: string | null
          updated_at?: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          is_high_priority?: boolean
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          name?: string | null
          pipeline_stage_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_pipeline_stage_id_fkey"
            columns: ["pipeline_stage_id"]
            isOneToOne: false
            referencedRelation: "pipeline_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_reply_rules: {
        Row: {
          active: boolean
          business_id: string | null
          id: string
          language: string
          reply_text: string
          rule_key: string
          trigger_keywords: string[]
          trigger_priority: number
          vertical: string
        }
        Insert: {
          active?: boolean
          business_id?: string | null
          id?: string
          language?: string
          reply_text: string
          rule_key: string
          trigger_keywords?: string[]
          trigger_priority?: number
          vertical: string
        }
        Update: {
          active?: boolean
          business_id?: string | null
          id?: string
          language?: string
          reply_text?: string
          rule_key?: string
          trigger_keywords?: string[]
          trigger_priority?: number
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "internal_reply_rules_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_reply_rules_vertical_fkey"
            columns: ["vertical"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      message_templates: {
        Row: {
          active: boolean
          approval_status: string | null
          business_id: string | null
          category: string | null
          channel_id: string
          id: string
          language: string
          meta_template_id: string | null
          meta_template_name: string | null
          parameters_schema: Json | null
          reply_text: string | null
          template_key: string
          vertical: string
        }
        Insert: {
          active?: boolean
          approval_status?: string | null
          business_id?: string | null
          category?: string | null
          channel_id: string
          id?: string
          language?: string
          meta_template_id?: string | null
          meta_template_name?: string | null
          parameters_schema?: Json | null
          reply_text?: string | null
          template_key: string
          vertical: string
        }
        Update: {
          active?: boolean
          approval_status?: string | null
          business_id?: string | null
          category?: string | null
          channel_id?: string
          id?: string
          language?: string
          meta_template_id?: string | null
          meta_template_name?: string | null
          parameters_schema?: Json | null
          reply_text?: string | null
          template_key?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_templates_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_templates_vertical_fkey"
            columns: ["vertical"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      messages: {
        Row: {
          business_id: string
          channel_id: string
          contact_id: string
          content: string | null
          created_at: string
          direction: string
          id: string
          is_auto_reply: boolean
          media_mime_type: string | null
          media_url: string | null
          message_type: string
          outbound_idempotency_key: string | null
          provider: string
          provider_media_id: string | null
          provider_message_id: string | null
          send_status: string | null
        }
        Insert: {
          business_id: string
          channel_id: string
          contact_id: string
          content?: string | null
          created_at?: string
          direction: string
          id?: string
          is_auto_reply?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          outbound_idempotency_key?: string | null
          provider: string
          provider_media_id?: string | null
          provider_message_id?: string | null
          send_status?: string | null
        }
        Update: {
          business_id?: string
          channel_id?: string
          contact_id?: string
          content?: string | null
          created_at?: string
          direction?: string
          id?: string
          is_auto_reply?: boolean
          media_mime_type?: string | null
          media_url?: string | null
          message_type?: string
          outbound_idempotency_key?: string | null
          provider?: string
          provider_media_id?: string | null
          provider_message_id?: string | null
          send_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      opt_out_keywords: {
        Row: {
          active: boolean
          business_id: string | null
          id: string
          keyword: string
          language: string
        }
        Insert: {
          active?: boolean
          business_id?: string | null
          id?: string
          keyword: string
          language?: string
        }
        Update: {
          active?: boolean
          business_id?: string | null
          id?: string
          keyword?: string
          language?: string
        }
        Relationships: [
          {
            foreignKeyName: "opt_out_keywords_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_field_values: {
        Row: {
          business_id: string
          contact_id: string
          created_at: string
          field_definition_id: string
          id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
          field_definition_id: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
          field_definition_id?: string
          id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_field_values_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_field_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "vertical_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_attention_queue: {
        Row: {
          business_id: string
          contact_id: string | null
          created_at: string
          id: string
          reason: string
          reference_id: string | null
          reference_type: string
          resolved_at: string | null
          resolved_by: string | null
        }
        Insert: {
          business_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          reason: string
          reference_id?: string | null
          reference_type: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Update: {
          business_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          reason?: string
          reference_id?: string | null
          reference_type?: string
          resolved_at?: string | null
          resolved_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "owner_attention_queue_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "owner_attention_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number
          business_id: string
          contact_id: string
          created_at: string
          due_date: string | null
          id: string
          order_reference: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          business_id: string
          contact_id: string
          created_at?: string
          due_date?: string | null
          id?: string
          order_reference?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          business_id?: string
          contact_id?: string
          created_at?: string
          due_date?: string | null
          id?: string
          order_reference?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stages: {
        Row: {
          business_id: string | null
          id: string
          sort_order: number
          stage_key: string
          stage_label: string
          vertical: string
        }
        Insert: {
          business_id?: string | null
          id?: string
          sort_order: number
          stage_key: string
          stage_label: string
          vertical: string
        }
        Update: {
          business_id?: string | null
          id?: string
          sort_order?: number
          stage_key?: string
          stage_label?: string
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stages_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stages_vertical_fkey"
            columns: ["vertical"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      pricing_plans: {
        Row: {
          active: boolean
          created_at: string
          entitlement_keys: string[]
          id: string
          plan_name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          entitlement_keys?: string[]
          id?: string
          plan_name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          entitlement_keys?: string[]
          id?: string
          plan_name?: string
        }
        Relationships: []
      }
      reminder_channel_consent: {
        Row: {
          business_id: string
          contact_id: string
          created_at: string
          id: string
          requested_at: string
          requested_channel_id: string
          responded_at: string | null
          source_channel_id: string
          status: string
        }
        Insert: {
          business_id: string
          contact_id: string
          created_at?: string
          id?: string
          requested_at?: string
          requested_channel_id: string
          responded_at?: string | null
          source_channel_id: string
          status: string
        }
        Update: {
          business_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          requested_at?: string
          requested_channel_id?: string
          responded_at?: string | null
          source_channel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_channel_consent_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_requested_channel_id_fkey"
            columns: ["requested_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_source_channel_id_fkey"
            columns: ["source_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
      reminders: {
        Row: {
          attempt_count: number
          business_id: string
          channel_id: string
          contact_id: string
          created_at: string
          failure_reason: string | null
          id: string
          idempotency_key: string
          locked_at: string | null
          message_template_id: string | null
          reminder_type: string
          scheduled_time_utc: string
          status: string
        }
        Insert: {
          attempt_count?: number
          business_id: string
          channel_id: string
          contact_id: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key: string
          locked_at?: string | null
          message_template_id?: string | null
          reminder_type: string
          scheduled_time_utc: string
          status?: string
        }
        Update: {
          attempt_count?: number
          business_id?: string
          channel_id?: string
          contact_id?: string
          created_at?: string
          failure_reason?: string | null
          id?: string
          idempotency_key?: string
          locked_at?: string | null
          message_template_id?: string | null
          reminder_type?: string
          scheduled_time_utc?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_message_template_id_fkey"
            columns: ["message_template_id"]
            isOneToOne: false
            referencedRelation: "message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      system_health: {
        Row: {
          job_key: string
          last_run_at: string
          updated_at: string
        }
        Insert: {
          job_key: string
          last_run_at: string
          updated_at?: string
        }
        Update: {
          job_key?: string
          last_run_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      vertical_field_definitions: {
        Row: {
          active: boolean
          field_key: string
          field_label: string
          field_type: string
          id: string
          is_required: boolean
          select_options: string[] | null
          sort_order: number
          vertical: string
        }
        Insert: {
          active?: boolean
          field_key: string
          field_label: string
          field_type: string
          id?: string
          is_required?: boolean
          select_options?: string[] | null
          sort_order?: number
          vertical: string
        }
        Update: {
          active?: boolean
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          is_required?: boolean
          select_options?: string[] | null
          sort_order?: number
          vertical?: string
        }
        Relationships: [
          {
            foreignKeyName: "vertical_field_definitions_vertical_fkey"
            columns: ["vertical"]
            isOneToOne: false
            referencedRelation: "verticals"
            referencedColumns: ["key"]
          },
        ]
      }
      verticals: {
        Row: {
          active: boolean
          created_at: string
          key: string
          label: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          key: string
          label: string
        }
        Update: {
          active?: boolean
          created_at?: string
          key?: string
          label?: string
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          business_id: string | null
          channel_id: string
          id: string
          processed_at: string | null
          provider: string
          provider_event_id: string | null
          raw_payload: Json
          received_at: string
          status: string
        }
        Insert: {
          business_id?: string | null
          channel_id: string
          id?: string
          processed_at?: string | null
          provider: string
          provider_event_id?: string | null
          raw_payload: Json
          received_at?: string
          status?: string
        }
        Update: {
          business_id?: string | null
          channel_id?: string
          id?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string | null
          raw_payload?: Json
          received_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_reminder_channel_consent: {
        Row: {
          business_id: string | null
          contact_id: string | null
          created_at: string | null
          id: string | null
          requested_at: string | null
          requested_channel_id: string | null
          responded_at: string | null
          source_channel_id: string | null
          status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reminder_channel_consent_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_requested_channel_id_fkey"
            columns: ["requested_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_channel_consent_source_channel_id_fkey"
            columns: ["source_channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      delete_provider_credential: {
        Args: { p_secret_id: string }
        Returns: undefined
      }
      get_provider_credential: {
        Args: { p_secret_id: string }
        Returns: string
      }
      store_provider_credential: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
      update_provider_credential: {
        Args: { p_secret: string; p_secret_id: string }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

