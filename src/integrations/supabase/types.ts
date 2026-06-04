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
    PostgrestVersion: "14.4"
  }
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
      activities: {
        Row: {
          changes: Json | null
          created_at: string
          description: string | null
          entity_id: string | null
          entity_name: string | null
          entity_type: string
          id: string
          responsible_id: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Insert: {
          changes?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type: string
          id?: string
          responsible_id?: string | null
          type: Database["public"]["Enums"]["activity_type"]
        }
        Update: {
          changes?: Json | null
          created_at?: string
          description?: string | null
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string
          id?: string
          responsible_id?: string | null
          type?: Database["public"]["Enums"]["activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "activities_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_attachments: {
        Row: {
          agent_id: string
          created_at: string
          created_by: string | null
          error_message: string | null
          extracted_text: string | null
          file_size_bytes: number | null
          file_type: string
          filename: string
          id: string
          status: string
          tokens_estimated: number | null
        }
        Insert: {
          agent_id: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          file_type: string
          filename: string
          id?: string
          status?: string
          tokens_estimated?: number | null
        }
        Update: {
          agent_id?: string
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          extracted_text?: string | null
          file_size_bytes?: number | null
          file_type?: string
          filename?: string
          id?: string
          status?: string
          tokens_estimated?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_attachments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_attachments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_attachments_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_public_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_attachments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_budget: {
        Row: {
          agent_id: string
          auto_block_at_100: boolean
          created_at: string
          id: string
          max_brl_per_user_per_month: number
          max_messages_per_user_per_day: number
          max_tokens_per_response: number
          monthly_limit_brl: number
          threshold_red_pct: number | null
          threshold_yellow_pct: number | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          auto_block_at_100?: boolean
          created_at?: string
          id?: string
          max_brl_per_user_per_month?: number
          max_messages_per_user_per_day?: number
          max_tokens_per_response?: number
          monthly_limit_brl?: number
          threshold_red_pct?: number | null
          threshold_yellow_pct?: number | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          auto_block_at_100?: boolean
          created_at?: string
          id?: string
          max_brl_per_user_per_month?: number
          max_messages_per_user_per_day?: number
          max_tokens_per_response?: number
          monthly_limit_brl?: number
          threshold_red_pct?: number | null
          threshold_yellow_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_budget_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_budget_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_budget_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_model_presets: {
        Row: {
          agent_id: string
          created_at: string
          id: string
          is_active_preset: boolean
          preset_key: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          id?: string
          is_active_preset?: boolean
          preset_key: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          id?: string
          is_active_preset?: boolean
          preset_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_model_presets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_model_presets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agent_model_presets_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_models: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          is_default: boolean
          model_id: string
          position: number
          preset_id: string
          provider: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          model_id: string
          position?: number
          preset_id: string
          provider: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          is_default?: boolean
          model_id?: string
          position?: number
          preset_id?: string
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_models_preset_id_fkey"
            columns: ["preset_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_model_presets"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents: {
        Row: {
          conversation_starters: Json | null
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          name: string
          system_prompt: string | null
          text_only_mode: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          conversation_starters?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          system_prompt?: string | null
          text_only_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          conversation_starters?: Json | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          name?: string
          system_prompt?: string | null
          text_only_mode?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_budget_alerts_sent: {
        Row: {
          agent_id: string | null
          id: string
          month_year: string
          sent_at: string
          threshold_level: string
        }
        Insert: {
          agent_id?: string | null
          id?: string
          month_year: string
          sent_at?: string
          threshold_level: string
        }
        Update: {
          agent_id?: string | null
          id?: string
          month_year?: string
          sent_at?: string
          threshold_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_budget_alerts_sent_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_budget_alerts_sent_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_admin_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_budget_alerts_sent_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "ai_agents_public_view"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_favorites: {
        Row: {
          created_at: string
          id: string
          message_id: string
          note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_favorites_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages: {
        Row: {
          content: string
          created_at: string
          has_attachment: boolean
          id: string
          model_id: string | null
          provider: string | null
          role: string
          session_id: string
          tokens_input: number | null
          tokens_output: number | null
          total_tokens: number | null
        }
        Insert: {
          content: string
          created_at?: string
          has_attachment?: boolean
          id?: string
          model_id?: string | null
          provider?: string | null
          role: string
          session_id: string
          tokens_input?: number | null
          tokens_output?: number | null
          total_tokens?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          has_attachment?: boolean
          id?: string
          model_id?: string | null
          provider?: string | null
          role?: string
          session_id?: string
          tokens_input?: number | null
          tokens_output?: number | null
          total_tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_messages_cost: {
        Row: {
          cost_brl_input: number | null
          cost_brl_output: number | null
          created_at: string
          id: string
          message_id: string | null
          message_id_fk: string | null
          model_id: string | null
          provider: string | null
          tokens_input: number | null
          tokens_output: number | null
          total_cost_brl: number | null
          user_id: string | null
        }
        Insert: {
          cost_brl_input?: number | null
          cost_brl_output?: number | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_id_fk?: string | null
          model_id?: string | null
          provider?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_cost_brl?: number | null
          user_id?: string | null
        }
        Update: {
          cost_brl_input?: number | null
          cost_brl_output?: number | null
          created_at?: string
          id?: string
          message_id?: string | null
          message_id_fk?: string | null
          model_id?: string | null
          provider?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          total_cost_brl?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_messages_cost_message_id_fk_fkey"
            columns: ["message_id_fk"]
            isOneToOne: false
            referencedRelation: "ai_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chat_messages_cost_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          last_message_at: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          id?: string
          last_message_at?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          last_message_at?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_provider_credentials: {
        Row: {
          api_key: string
          created_at: string
          id: string
          is_active: boolean
          last_test_status: string | null
          last_tested_at: string | null
          provider: string
          updated_at: string
        }
        Insert: {
          api_key: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_status?: string | null
          last_tested_at?: string | null
          provider: string
          updated_at?: string
        }
        Update: {
          api_key?: string
          created_at?: string
          id?: string
          is_active?: boolean
          last_test_status?: string | null
          last_tested_at?: string | null
          provider?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_rate_limit: {
        Row: {
          called_at: string
          ef_name: string
          id: string
          user_id: string
        }
        Insert: {
          called_at?: string
          ef_name: string
          id?: string
          user_id: string
        }
        Update: {
          called_at?: string
          ef_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          ai_enabled: boolean
          api_key: string | null
          created_at: string
          features: Json
          id: string
          model: string | null
          provider: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ai_enabled?: boolean
          api_key?: string | null
          created_at?: string
          features?: Json
          id?: string
          model?: string | null
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ai_enabled?: boolean
          api_key?: string | null
          created_at?: string
          features?: Json
          id?: string
          model?: string | null
          provider?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      board_items: {
        Row: {
          board_id: string
          contact_id: string
          created_at: string
          id: string
          moved_at: string
          ordem: number
          stage_id: string
        }
        Insert: {
          board_id: string
          contact_id: string
          created_at?: string
          id?: string
          moved_at?: string
          ordem?: number
          stage_id: string
        }
        Update: {
          board_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          moved_at?: string
          ordem?: number
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_items_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      board_stages: {
        Row: {
          board_id: string
          cor: string | null
          created_at: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          board_id: string
          cor?: string | null
          created_at?: string
          id?: string
          nome: string
          ordem: number
          updated_at?: string
        }
        Update: {
          board_id?: string
          cor?: string | null
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_stages_board_id_fkey"
            columns: ["board_id"]
            isOneToOne: false
            referencedRelation: "boards"
            referencedColumns: ["id"]
          },
        ]
      }
      boards: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          is_default: boolean
          nome: string
          tipo_entidade: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_default?: boolean
          nome: string
          tipo_entidade?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          is_default?: boolean
          nome?: string
          tipo_entidade?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "boards_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_settings: {
        Row: {
          created_at: string
          id: string
          mandate_name: string
          meta_votos: number | null
          politician_name: string
          politician_photo_url: string | null
          primary_color: string
          updated_at: string
          vote_goal: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          mandate_name?: string
          meta_votos?: number | null
          politician_name?: string
          politician_photo_url?: string | null
          primary_color?: string
          updated_at?: string
          vote_goal?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          mandate_name?: string
          meta_votos?: number | null
          politician_name?: string
          politician_photo_url?: string | null
          primary_color?: string
          updated_at?: string
          vote_goal?: number | null
        }
        Relationships: []
      }
      campaign_fields: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          label: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_fields_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_personalizados: {
        Row: {
          chave: string
          created_at: string
          created_by: string | null
          entidade: string
          filtravel: boolean
          id: string
          opcoes: Json | null
          ordem: number
          rotulo: string
          tipo: Database["public"]["Enums"]["campo_personalizado_tipo"]
          updated_at: string
        }
        Insert: {
          chave: string
          created_at?: string
          created_by?: string | null
          entidade?: string
          filtravel?: boolean
          id?: string
          opcoes?: Json | null
          ordem?: number
          rotulo: string
          tipo: Database["public"]["Enums"]["campo_personalizado_tipo"]
          updated_at?: string
        }
        Update: {
          chave?: string
          created_at?: string
          created_by?: string | null
          entidade?: string
          filtravel?: boolean
          id?: string
          opcoes?: Json | null
          ordem?: number
          rotulo?: string
          tipo?: Database["public"]["Enums"]["campo_personalizado_tipo"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campos_personalizados_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      campos_personalizados_valores: {
        Row: {
          campo_id: string
          contact_id: string
          created_at: string
          id: string
          updated_at: string
          valor_bool: boolean | null
          valor_data: string | null
          valor_numero: number | null
          valor_selecao: string | null
          valor_texto: string | null
        }
        Insert: {
          campo_id: string
          contact_id: string
          created_at?: string
          id?: string
          updated_at?: string
          valor_bool?: boolean | null
          valor_data?: string | null
          valor_numero?: number | null
          valor_selecao?: string | null
          valor_texto?: string | null
        }
        Update: {
          campo_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          valor_bool?: boolean | null
          valor_data?: string | null
          valor_numero?: number | null
          valor_selecao?: string | null
          valor_texto?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campos_personalizados_valores_campo_id_fkey"
            columns: ["campo_id"]
            isOneToOne: false
            referencedRelation: "campos_personalizados"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campos_personalizados_valores_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      cep_coordinates: {
        Row: {
          address: string | null
          cep: string
          city: string | null
          created_at: string
          id: string
          is_valid: boolean | null
          latitude: number | null
          longitude: number | null
          neighborhood: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          cep: string
          city?: string | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          cep?: string
          city?: string | null
          created_at?: string
          id?: string
          is_valid?: boolean | null
          latitude?: number | null
          longitude?: number | null
          neighborhood?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      contact_campaign_values: {
        Row: {
          campaign_field_id: string
          contact_id: string
          created_at: string
          updated_at: string
          valor: boolean
        }
        Insert: {
          campaign_field_id: string
          contact_id: string
          created_at?: string
          updated_at?: string
          valor?: boolean
        }
        Update: {
          campaign_field_id?: string
          contact_id?: string
          created_at?: string
          updated_at?: string
          valor?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_campaign_values_campaign_field_id_fkey"
            columns: ["campaign_field_id"]
            isOneToOne: false
            referencedRelation: "campaign_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_campaign_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_event_rsvps: {
        Row: {
          contact_id: string
          created_at: string
          event_id: string
          id: string
          respondido_em: string | null
          status: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          event_id: string
          id?: string
          respondido_em?: string | null
          status?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          event_id?: string
          id?: string
          respondido_em?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_event_rsvps_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_event_rsvps_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "mandato_events"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_merges: {
        Row: {
          deleted_contact_id: string
          deleted_contact_snapshot: Json
          id: string
          kept_contact_id: string
          merged_at: string
          merged_by: string | null
          merged_fields: Json | null
        }
        Insert: {
          deleted_contact_id: string
          deleted_contact_snapshot: Json
          id?: string
          kept_contact_id: string
          merged_at?: string
          merged_by?: string | null
          merged_fields?: Json | null
        }
        Update: {
          deleted_contact_id?: string
          deleted_contact_snapshot?: Json
          id?: string
          kept_contact_id?: string
          merged_at?: string
          merged_by?: string | null
          merged_fields?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_merges_kept_contact_id_fkey"
            columns: ["kept_contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_merges_merged_by_fkey"
            columns: ["merged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_sync: {
        Row: {
          contact_id: string
          created_at: string
          google_resource_name: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          sync_direction: Database["public"]["Enums"]["sync_direction_type"]
          sync_status: Database["public"]["Enums"]["sync_status_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          google_resource_name?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          sync_direction?: Database["public"]["Enums"]["sync_direction_type"]
          sync_status?: Database["public"]["Enums"]["sync_status_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          google_resource_name?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          sync_direction?: Database["public"]["Enums"]["sync_direction_type"]
          sync_status?: Database["public"]["Enums"]["sync_status_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_sync_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          contact_id: string
          tag_id: string
        }
        Insert: {
          contact_id: string
          tag_id: string
        }
        Update: {
          contact_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          aceita_whatsapp: boolean | null
          ai_next_action: string | null
          ai_next_action_at: string | null
          atualizado_por: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          data_nascimento: string | null
          declarou_voto: boolean | null
          e_multiplicador: boolean | null
          em_canal_whatsapp: boolean | null
          email: string | null
          estado: string | null
          facebook: string | null
          genero: string | null
          google_contact_id: string | null
          google_etag: string | null
          google_last_synced_at: string | null
          google_resource_name: string | null
          grupo_politico: string | null
          id: string
          instagram: string | null
          is_favorite: boolean | null
          lat: number | null
          leader_id: string | null
          lng: number | null
          logradouro: string | null
          merge_count: number | null
          merged_from: string[] | null
          merged_into: string | null
          nome: string
          nome_whatsapp: string | null
          notas_assessor: string | null
          numero: string | null
          observacoes: string | null
          optin_data: string | null
          optin_origem: string | null
          optin_whatsapp: boolean
          origem: string | null
          pin_color: string | null
          profissao: string | null
          ranking: number | null
          ranking_manual_legado: number | null
          ranking_manual_override: boolean
          secao_eleitoral: string | null
          telefone: string | null
          tiktok: string | null
          titulo_eleitor: string | null
          twitter: string | null
          ultimo_contato: string | null
          updated_at: string
          whatsapp: string | null
          youtube: string | null
          zona_eleitoral: string | null
        }
        Insert: {
          aceita_whatsapp?: boolean | null
          ai_next_action?: string | null
          ai_next_action_at?: string | null
          atualizado_por?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          declarou_voto?: boolean | null
          e_multiplicador?: boolean | null
          em_canal_whatsapp?: boolean | null
          email?: string | null
          estado?: string | null
          facebook?: string | null
          genero?: string | null
          google_contact_id?: string | null
          google_etag?: string | null
          google_last_synced_at?: string | null
          google_resource_name?: string | null
          grupo_politico?: string | null
          id?: string
          instagram?: string | null
          is_favorite?: boolean | null
          lat?: number | null
          leader_id?: string | null
          lng?: number | null
          logradouro?: string | null
          merge_count?: number | null
          merged_from?: string[] | null
          merged_into?: string | null
          nome: string
          nome_whatsapp?: string | null
          notas_assessor?: string | null
          numero?: string | null
          observacoes?: string | null
          optin_data?: string | null
          optin_origem?: string | null
          optin_whatsapp?: boolean
          origem?: string | null
          pin_color?: string | null
          profissao?: string | null
          ranking?: number | null
          ranking_manual_legado?: number | null
          ranking_manual_override?: boolean
          secao_eleitoral?: string | null
          telefone?: string | null
          tiktok?: string | null
          titulo_eleitor?: string | null
          twitter?: string | null
          ultimo_contato?: string | null
          updated_at?: string
          whatsapp?: string | null
          youtube?: string | null
          zona_eleitoral?: string | null
        }
        Update: {
          aceita_whatsapp?: boolean | null
          ai_next_action?: string | null
          ai_next_action_at?: string | null
          atualizado_por?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          data_nascimento?: string | null
          declarou_voto?: boolean | null
          e_multiplicador?: boolean | null
          em_canal_whatsapp?: boolean | null
          email?: string | null
          estado?: string | null
          facebook?: string | null
          genero?: string | null
          google_contact_id?: string | null
          google_etag?: string | null
          google_last_synced_at?: string | null
          google_resource_name?: string | null
          grupo_politico?: string | null
          id?: string
          instagram?: string | null
          is_favorite?: boolean | null
          lat?: number | null
          leader_id?: string | null
          lng?: number | null
          logradouro?: string | null
          merge_count?: number | null
          merged_from?: string[] | null
          merged_into?: string | null
          nome?: string
          nome_whatsapp?: string | null
          notas_assessor?: string | null
          numero?: string | null
          observacoes?: string | null
          optin_data?: string | null
          optin_origem?: string | null
          optin_whatsapp?: boolean
          origem?: string | null
          pin_color?: string | null
          profissao?: string | null
          ranking?: number | null
          ranking_manual_legado?: number | null
          ranking_manual_override?: boolean
          secao_eleitoral?: string | null
          telefone?: string | null
          tiktok?: string | null
          titulo_eleitor?: string | null
          twitter?: string | null
          ultimo_contato?: string | null
          updated_at?: string
          whatsapp?: string | null
          youtube?: string | null
          zona_eleitoral?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_merged_into_fkey"
            columns: ["merged_into"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      dashboard_alert_dismissals: {
        Row: {
          alert_key: string
          alert_subtitle: string | null
          alert_title: string | null
          alert_type: string
          dismissed_at: string
          expires_at: string
          id: string
          user_id: string
        }
        Insert: {
          alert_key: string
          alert_subtitle?: string | null
          alert_title?: string | null
          alert_type?: string
          dismissed_at?: string
          expires_at?: string
          id?: string
          user_id: string
        }
        Update: {
          alert_key?: string
          alert_subtitle?: string | null
          alert_title?: string | null
          alert_type?: string
          dismissed_at?: string
          expires_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      demand_tags: {
        Row: {
          demand_id: string
          tag_id: string
        }
        Insert: {
          demand_id: string
          tag_id: string
        }
        Update: {
          demand_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_tags_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          neighborhood: string | null
          priority: Database["public"]["Enums"]["demand_priority"]
          protocolo: string | null
          responsible_id: string | null
          status: Database["public"]["Enums"]["demand_status"]
          title: string
          updated_at: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          neighborhood?: string | null
          priority?: Database["public"]["Enums"]["demand_priority"]
          protocolo?: string | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["demand_status"]
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          neighborhood?: string | null
          priority?: Database["public"]["Enums"]["demand_priority"]
          protocolo?: string | null
          responsible_id?: string | null
          status?: Database["public"]["Enums"]["demand_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "demands_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_responsible_id_fkey"
            columns: ["responsible_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dismissed_duplicate_groups: {
        Row: {
          dismissed_at: string
          dismissed_by: string | null
          id: string
          match_field: string
          match_value: string
          reason: string | null
        }
        Insert: {
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          match_field: string
          match_value: string
          reason?: string | null
        }
        Update: {
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          match_field?: string
          match_value?: string
          reason?: string | null
        }
        Relationships: []
      }
      google_oauth_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string
          google_email: string | null
          id: string
          is_active: boolean
          refresh_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at: string
          google_email?: string | null
          id?: string
          is_active?: boolean
          refresh_token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string
          google_email?: string | null
          id?: string
          is_active?: boolean
          refresh_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      google_sync_logs: {
        Row: {
          contact_id: string | null
          created_at: string
          details: Json | null
          direction: Database["public"]["Enums"]["sync_direction_type"]
          error_message: string | null
          id: string
          operation: string
          status: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          details?: Json | null
          direction: Database["public"]["Enums"]["sync_direction_type"]
          error_message?: string | null
          id?: string
          operation: string
          status: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          details?: Json | null
          direction?: Database["public"]["Enums"]["sync_direction_type"]
          error_message?: string | null
          id?: string
          operation?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_sync_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      google_sync_settings: {
        Row: {
          bidirectional_sync: boolean
          created_at: string
          id: string
          keep_on_google_delete: boolean
          last_full_sync: string | null
          last_sync_token: string | null
          sync_enabled: boolean
          sync_tags: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          bidirectional_sync?: boolean
          created_at?: string
          id?: string
          keep_on_google_delete?: boolean
          last_full_sync?: string | null
          last_sync_token?: string | null
          sync_enabled?: boolean
          sync_tags?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          bidirectional_sync?: boolean
          created_at?: string
          id?: string
          keep_on_google_delete?: boolean
          last_full_sync?: string | null
          last_sync_token?: string | null
          sync_enabled?: boolean
          sync_tags?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      leader_types: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          label: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leader_types_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leaders: {
        Row: {
          active: boolean
          address: string | null
          birth_date: string | null
          city: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          instagram: string | null
          leader_type_id: string
          neighborhoods: string[] | null
          nome: string
          phone: string | null
          region: string | null
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          leader_type_id: string
          neighborhoods?: string[] | null
          nome: string
          phone?: string | null
          region?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          address?: string | null
          birth_date?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          instagram?: string | null
          leader_type_id?: string
          neighborhoods?: string[] | null
          nome?: string
          phone?: string | null
          region?: string | null
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leaders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leaders_leader_type_id_fkey"
            columns: ["leader_type_id"]
            isOneToOne: false
            referencedRelation: "leader_types"
            referencedColumns: ["id"]
          },
        ]
      }
      mandato_events: {
        Row: {
          account_id: string
          created_at: string
          created_by: string
          data_evento: string
          descricao: string | null
          id: string
          local: string | null
          title: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by: string
          data_evento: string
          descricao?: string | null
          id?: string
          local?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string
          data_evento?: string
          descricao?: string | null
          id?: string
          local?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandato_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "mandato_events_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      oauth_state_nonces: {
        Row: {
          consumed: boolean
          created_at: string
          expires_at: string
          nonce: string
          user_id: string
        }
        Insert: {
          consumed?: boolean
          created_at?: string
          expires_at?: string
          nonce: string
          user_id: string
        }
        Update: {
          consumed?: boolean
          created_at?: string
          expires_at?: string
          nonce?: string
          user_id?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          action: string
          created_at: string
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      permissoes_perfil: {
        Row: {
          created_at: string
          id: string
          pode_criar: boolean
          pode_deletar: boolean
          pode_deletar_em_massa: boolean
          pode_editar: boolean
          pode_ver: boolean
          role: string
          secao: string
          so_proprio: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          pode_criar?: boolean
          pode_deletar?: boolean
          pode_deletar_em_massa?: boolean
          pode_editar?: boolean
          pode_ver?: boolean
          role: string
          secao: string
          so_proprio?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          pode_criar?: boolean
          pode_deletar?: boolean
          pode_deletar_em_massa?: boolean
          pode_editar?: boolean
          pode_ver?: boolean
          role?: string
          secao?: string
          so_proprio?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: string
          senha_temporaria: boolean
          status_aprovacao: string
          telefone: string | null
          theme_preference: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: string
          senha_temporaria?: boolean
          status_aprovacao?: string
          telefone?: string | null
          theme_preference?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: string
          senha_temporaria?: boolean
          status_aprovacao?: string
          telefone?: string | null
          theme_preference?: string | null
        }
        Relationships: []
      }
      stage_checklist_attachments: {
        Row: {
          created_at: string
          id: string
          item_id: string
          mime_type: string | null
          nome_original: string | null
          ordem: number
          rotulo: string | null
          storage_path: string | null
          tamanho_bytes: number | null
          tipo: string
          url_externa: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          mime_type?: string | null
          nome_original?: string | null
          ordem?: number
          rotulo?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo: string
          url_externa?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          mime_type?: string | null
          nome_original?: string | null
          ordem?: number
          rotulo?: string | null
          storage_path?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          url_externa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stage_checklist_attachments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "stage_checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_checklist_items: {
        Row: {
          created_at: string
          created_by: string | null
          descricao: string | null
          id: string
          ordem: number
          stage_id: string
          texto: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          stage_id: string
          texto: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          id?: string
          ordem?: number
          stage_id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_checklist_items_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_message_templates: {
        Row: {
          conteudo: string
          created_at: string
          created_by: string | null
          id: string
          ordem: number
          stage_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordem?: number
          stage_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          ordem?: number
          stage_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stage_message_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stage_message_templates_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      tag_groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_system: boolean
          label: string
          ordem: number
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label: string
          ordem?: number
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_system?: boolean
          label?: string
          ordem?: number
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tag_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          cor: string | null
          created_at: string
          created_by: string | null
          group_id: string
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          group_id: string
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          created_by?: string | null
          group_id?: string
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tags_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "tag_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tarefas: {
        Row: {
          board_item_id: string | null
          concluida: boolean
          concluida_em: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          data_agendada: string | null
          demand_id: string | null
          descricao: string | null
          id: string
          leader_id: string | null
          prioridade: string | null
          responsavel_id: string | null
          tipo: Database["public"]["Enums"]["tarefa_tipo"]
          titulo: string
          updated_at: string
        }
        Insert: {
          board_item_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          demand_id?: string | null
          descricao?: string | null
          id?: string
          leader_id?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["tarefa_tipo"]
          titulo: string
          updated_at?: string
        }
        Update: {
          board_item_id?: string | null
          concluida?: boolean
          concluida_em?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          demand_id?: string | null
          descricao?: string | null
          id?: string
          leader_id?: string | null
          prioridade?: string | null
          responsavel_id?: string | null
          tipo?: Database["public"]["Enums"]["tarefa_tipo"]
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_board_item_id_fkey"
            columns: ["board_item_id"]
            isOneToOne: false
            referencedRelation: "board_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_leader_id_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "leaders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tarefas_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          active: boolean
          bio: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          role: string | null
          social_links: Json | null
        }
        Insert: {
          active?: boolean
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          role?: string | null
          social_links?: Json | null
        }
        Update: {
          active?: boolean
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string | null
          social_links?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "team_members_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_dashboard_layouts: {
        Row: {
          created_at: string
          layout: Json
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          created_at?: string
          layout: Json
          updated_at?: string
          user_id: string
          version?: number
        }
        Update: {
          created_at?: string
          layout?: Json
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          request_id: number | null
          response: string | null
          status_code: number | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          request_id?: number | null
          response?: string | null
          status_code?: number | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          request_id?: number | null
          response?: string | null
          status_code?: number | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks: {
        Row: {
          created_at: string
          events: string[]
          id: string
          is_active: boolean
          name: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          events?: string[]
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      zapi_accounts: {
        Row: {
          client_token: string
          created_at: string
          created_by: string | null
          horario_atendimento: Json | null
          id: string
          instance_id: string
          instance_token: string
          name: string
          recursos_config: Json
          status: string
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          client_token: string
          created_at?: string
          created_by?: string | null
          horario_atendimento?: Json | null
          id?: string
          instance_id: string
          instance_token: string
          name: string
          recursos_config?: Json
          status?: string
          updated_at?: string
          webhook_secret?: string
        }
        Update: {
          client_token?: string
          created_at?: string
          created_by?: string | null
          horario_atendimento?: Json | null
          id?: string
          instance_id?: string
          instance_token?: string
          name?: string
          recursos_config?: Json
          status?: string
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      zapi_audit_log: {
        Row: {
          account_id: string | null
          actor_id: string | null
          chat_id: string | null
          contact_id: string | null
          created_at: string
          event_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
        }
        Insert: {
          account_id?: string | null
          actor_id?: string | null
          chat_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Update: {
          account_id?: string | null
          actor_id?: string | null
          chat_id?: string | null
          contact_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_audit_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_audit_log_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_audit_log_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_broadcast_poll_votes: {
        Row: {
          broadcast_id: string
          contact_id: string | null
          id: string
          option_voted: string
          phone: string
          received_at: string
        }
        Insert: {
          broadcast_id: string
          contact_id?: string | null
          id?: string
          option_voted: string
          phone: string
          received_at?: string
        }
        Update: {
          broadcast_id?: string
          contact_id?: string | null
          id?: string
          option_voted?: string
          phone?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_broadcast_poll_votes_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "zapi_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_broadcast_poll_votes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_broadcast_targets: {
        Row: {
          bloqueio_motivo: string | null
          broadcast_id: string
          contact_id: string | null
          created_at: string
          error_msg: string | null
          id: string
          phone: string
          sent_at: string | null
          status: string
        }
        Insert: {
          bloqueio_motivo?: string | null
          broadcast_id: string
          contact_id?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          phone: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          bloqueio_motivo?: string | null
          broadcast_id?: string
          contact_id?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          phone?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_broadcast_targets_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "zapi_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_broadcast_targets_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_broadcasts: {
        Row: {
          account_id: string
          body: string
          created_at: string
          created_by: string
          failed_count: number
          finished_at: string | null
          id: string
          poll_options: Json | null
          poll_question: string | null
          ritmo_por_minuto: number
          scheduled_at: string | null
          segment_filters: Json
          sent_count: number
          started_at: string | null
          status: string
          tipo: string
          title: string
          total_targets: number
        }
        Insert: {
          account_id: string
          body: string
          created_at?: string
          created_by: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          poll_options?: Json | null
          poll_question?: string | null
          ritmo_por_minuto?: number
          scheduled_at?: string | null
          segment_filters?: Json
          sent_count?: number
          started_at?: string | null
          status?: string
          tipo?: string
          title: string
          total_targets?: number
        }
        Update: {
          account_id?: string
          body?: string
          created_at?: string
          created_by?: string
          failed_count?: number
          finished_at?: string | null
          id?: string
          poll_options?: Json | null
          poll_question?: string | null
          ritmo_por_minuto?: number
          scheduled_at?: string | null
          segment_filters?: Json
          sent_count?: number
          started_at?: string | null
          status?: string
          tipo?: string
          title?: string
          total_targets?: number
        }
        Relationships: [
          {
            foreignKeyName: "zapi_broadcasts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_broadcasts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_chat_message_flags: {
        Row: {
          chat_id: string
          created_at: string
          flagged_by: string
          id: string
          message_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          flagged_by: string
          id?: string
          message_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          flagged_by?: string
          id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_chat_message_flags_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_chat_notes: {
        Row: {
          autor_id: string
          chat_id: string
          corpo: string
          created_at: string
          id: string
          mencoes: Json | null
          updated_at: string
        }
        Insert: {
          autor_id: string
          chat_id: string
          corpo: string
          created_at?: string
          id?: string
          mencoes?: Json | null
          updated_at?: string
        }
        Update: {
          autor_id?: string
          chat_id?: string
          corpo?: string
          created_at?: string
          id?: string
          mencoes?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_chat_notes_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_chat_notes_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_chat_tags: {
        Row: {
          chat_id: string
          created_at: string
          created_by: string | null
          id: string
          tag_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_chat_tags_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_chat_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_chats: {
        Row: {
          account_id: string
          ai_analyzed_at: string | null
          ai_intent: string | null
          ai_sentiment: string | null
          ai_summary: string | null
          archived: boolean
          assigned_to: string | null
          contact_id: string | null
          created_at: string
          demand_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          phone: string
          pinned: boolean
          snoozed_until: string | null
          status: string
          unread_count: number
          updated_at: string
          whatsapp_name: string | null
        }
        Insert: {
          account_id: string
          ai_analyzed_at?: string | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          archived?: boolean
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          demand_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone: string
          pinned?: boolean
          snoozed_until?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          whatsapp_name?: string | null
        }
        Update: {
          account_id?: string
          ai_analyzed_at?: string | null
          ai_intent?: string | null
          ai_sentiment?: string | null
          ai_summary?: string | null
          archived?: boolean
          assigned_to?: string | null
          contact_id?: string | null
          created_at?: string
          demand_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          phone?: string
          pinned?: boolean
          snoozed_until?: string | null
          status?: string
          unread_count?: number
          updated_at?: string
          whatsapp_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_chats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_chats_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_chats_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_chats_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_messages: {
        Row: {
          account_id: string
          body: string | null
          chat_id: string
          created_at: string
          deleted_at: string | null
          direction: string
          edited_at: string | null
          edited_body: string | null
          id: string
          media_caption: string | null
          media_filename: string | null
          media_metadata: Json | null
          media_mime: string | null
          media_type: string
          media_url: string | null
          message_id: string
          quoted_body: string | null
          quoted_message_id: string | null
          quoted_type: string | null
          sent_at: string
          status: string
          transcribed_at: string | null
          transcription: string | null
        }
        Insert: {
          account_id: string
          body?: string | null
          chat_id: string
          created_at?: string
          deleted_at?: string | null
          direction: string
          edited_at?: string | null
          edited_body?: string | null
          id?: string
          media_caption?: string | null
          media_filename?: string | null
          media_metadata?: Json | null
          media_mime?: string | null
          media_type?: string
          media_url?: string | null
          message_id: string
          quoted_body?: string | null
          quoted_message_id?: string | null
          quoted_type?: string | null
          sent_at?: string
          status?: string
          transcribed_at?: string | null
          transcription?: string | null
        }
        Update: {
          account_id?: string
          body?: string | null
          chat_id?: string
          created_at?: string
          deleted_at?: string | null
          direction?: string
          edited_at?: string | null
          edited_body?: string | null
          id?: string
          media_caption?: string | null
          media_filename?: string | null
          media_metadata?: Json | null
          media_mime?: string | null
          media_type?: string
          media_url?: string | null
          message_id?: string
          quoted_body?: string | null
          quoted_message_id?: string | null
          quoted_type?: string | null
          sent_at?: string
          status?: string
          transcribed_at?: string | null
          transcription?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_panel_grants: {
        Row: {
          account_id: string
          expires_at: string
          granted_at: string
          id: string
          user_id: string
        }
        Insert: {
          account_id: string
          expires_at: string
          granted_at?: string
          id?: string
          user_id: string
        }
        Update: {
          account_id?: string
          expires_at?: string
          granted_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_panel_grants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_panel_grants_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_panel_passwords: {
        Row: {
          account_id: string
          id: string
          password_hash: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_id: string
          id?: string
          password_hash: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_id?: string
          id?: string
          password_hash?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_panel_passwords_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_panel_passwords_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_panel_rate_limits: {
        Row: {
          account_id: string
          failed_attempts: number
          locked_until: string | null
          user_id: string
          window_start: string
        }
        Insert: {
          account_id: string
          failed_attempts?: number
          locked_until?: string | null
          user_id: string
          window_start?: string
        }
        Update: {
          account_id?: string
          failed_attempts?: number
          locked_until?: string | null
          user_id?: string
          window_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_panel_rate_limits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_panel_rate_limits_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_quick_replies: {
        Row: {
          account_id: string
          categoria: string | null
          corpo: string
          created_at: string
          created_by: string | null
          id: string
          titulo: string
          updated_at: string
          variaveis: Json | null
        }
        Insert: {
          account_id: string
          categoria?: string | null
          corpo: string
          created_at?: string
          created_by?: string | null
          id?: string
          titulo: string
          updated_at?: string
          variaveis?: Json | null
        }
        Update: {
          account_id?: string
          categoria?: string | null
          corpo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          titulo?: string
          updated_at?: string
          variaveis?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "zapi_quick_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_quick_replies_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_relationship_rules: {
        Row: {
          account_id: string
          ativo: boolean
          board_stage_id: string | null
          created_at: string
          created_by: string
          dias_sem_resposta: number
          id: string
          mensagem_template: string
          nome: string
        }
        Insert: {
          account_id: string
          ativo?: boolean
          board_stage_id?: string | null
          created_at?: string
          created_by: string
          dias_sem_resposta: number
          id?: string
          mensagem_template: string
          nome: string
        }
        Update: {
          account_id?: string
          ativo?: boolean
          board_stage_id?: string | null
          created_at?: string
          created_by?: string
          dias_sem_resposta?: number
          id?: string
          mensagem_template?: string
          nome?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_relationship_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_relationship_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_relationship_rules_board_stage_id_fkey"
            columns: ["board_stage_id"]
            isOneToOne: false
            referencedRelation: "board_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_scheduled_messages: {
        Row: {
          account_id: string
          body: string
          chat_id: string | null
          created_at: string
          created_by: string | null
          error_msg: string | null
          id: string
          phone: string
          processing_started_at: string | null
          quoted_message_id: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
        }
        Insert: {
          account_id: string
          body: string
          chat_id?: string | null
          created_at?: string
          created_by?: string | null
          error_msg?: string | null
          id?: string
          phone: string
          processing_started_at?: string | null
          quoted_message_id?: string | null
          scheduled_at: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          account_id?: string
          body?: string
          chat_id?: string | null
          created_at?: string
          created_by?: string | null
          error_msg?: string | null
          id?: string
          phone?: string
          processing_started_at?: string | null
          quoted_message_id?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_scheduled_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_scheduled_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zapi_scheduled_messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "zapi_chats"
            referencedColumns: ["id"]
          },
        ]
      }
      zapi_webhook_log: {
        Row: {
          account_id: string | null
          error_detail: string | null
          event_type: string
          id: string
          payload: Json
          processing_status: string
          received_at: string
        }
        Insert: {
          account_id?: string | null
          error_detail?: string | null
          event_type: string
          id?: string
          payload: Json
          processing_status?: string
          received_at?: string
        }
        Update: {
          account_id?: string | null
          error_detail?: string | null
          event_type?: string
          id?: string
          payload?: Json
          processing_status?: string
          received_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "zapi_webhook_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "v_dashboard_atendimento"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "zapi_webhook_log_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "zapi_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ai_agents_admin_view: {
        Row: {
          conversation_starters: Json | null
          created_at: string | null
          created_by: string | null
          id: string | null
          is_active: boolean | null
          name: string | null
          system_prompt: string | null
          text_only_mode: boolean | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          conversation_starters?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          system_prompt?: string | null
          text_only_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          conversation_starters?: Json | null
          created_at?: string | null
          created_by?: string | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
          system_prompt?: string | null
          text_only_mode?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_agents_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agents_public_view: {
        Row: {
          conversation_starters: Json | null
          id: string | null
          is_active: boolean | null
          name: string | null
        }
        Insert: {
          conversation_starters?: Json | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Update: {
          conversation_starters?: Json | null
          id?: string | null
          is_active?: boolean | null
          name?: string | null
        }
        Relationships: []
      }
      ai_provider_credentials_admin_view: {
        Row: {
          api_key_masked: string | null
          api_key_set: boolean | null
          created_at: string | null
          id: string | null
          is_active: boolean | null
          last_test_status: string | null
          last_tested_at: string | null
          provider: string | null
          updated_at: string | null
        }
        Insert: {
          api_key_masked?: never
          api_key_set?: never
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_test_status?: string | null
          last_tested_at?: string | null
          provider?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key_masked?: never
          api_key_set?: never
          created_at?: string | null
          id?: string | null
          is_active?: boolean | null
          last_test_status?: string | null
          last_tested_at?: string | null
          provider?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_provider_credentials_public_view: {
        Row: {
          is_active: boolean | null
          last_test_status: string | null
          provider: string | null
        }
        Insert: {
          is_active?: boolean | null
          last_test_status?: string | null
          provider?: string | null
        }
        Update: {
          is_active?: boolean | null
          last_test_status?: string | null
          provider?: string | null
        }
        Relationships: []
      }
      ai_settings_admin_view: {
        Row: {
          ai_enabled: boolean | null
          api_key_masked: string | null
          api_key_set: boolean | null
          created_at: string | null
          features: Json | null
          id: string | null
          model: string | null
          provider: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          ai_enabled?: boolean | null
          api_key_masked?: never
          api_key_set?: never
          created_at?: string | null
          features?: Json | null
          id?: string | null
          model?: string | null
          provider?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          ai_enabled?: boolean | null
          api_key_masked?: never
          api_key_set?: never
          created_at?: string | null
          features?: Json | null
          id?: string | null
          model?: string | null
          provider?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      google_oauth_tokens_safe: {
        Row: {
          created_at: string | null
          expires_at: string | null
          google_email: string | null
          id: string | null
          is_active: boolean | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          google_email?: string | null
          id?: string | null
          is_active?: boolean | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      v_dashboard_atendimento: {
        Row: {
          account_id: string | null
          conversas_abertas: number | null
          conversas_finalizadas_hoje: number | null
          conversas_por_atendente: Json | null
          tempo_medio_resposta_min: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      _api_assert_resource: { Args: { p_resource: string }; Returns: undefined }
      _calc_ranking_from_row: {
        Args: { p_contact: Database["public"]["Tables"]["contacts"]["Row"] }
        Returns: number
      }
      ai_agent_current_spend: { Args: { p_agent_id: string }; Returns: number }
      ai_count_user_messages_today: {
        Args: { p_user_id: string }
        Returns: number
      }
      ai_record_assistant_message: {
        Args: {
          p_content: string
          p_cost_brl_input: number
          p_cost_brl_output: number
          p_model_id: string
          p_provider: string
          p_session_id: string
          p_tokens_input: number
          p_tokens_output: number
          p_total_cost_brl: number
          p_total_tokens: number
          p_user_id: string
        }
        Returns: Json
      }
      ai_reserve_user_quota: {
        Args: {
          p_auto_block: boolean
          p_max_brl_per_month: number
          p_max_msgs_per_day: number
          p_monthly_limit_brl: number
          p_user_id: string
        }
        Returns: Json
      }
      api_delete: {
        Args: { p_id: string; p_resource: string; p_user_id: string }
        Returns: Json
      }
      api_find_contact_by_lookup: {
        Args: { p_field: string; p_user_id: string; p_value: string }
        Returns: Json
      }
      api_find_contact_by_phone: {
        Args: { p_phone_normalized: string; p_user_id: string }
        Returns: Json
      }
      api_get_one: {
        Args: { p_id: string; p_resource: string; p_user_id: string }
        Returns: Json
      }
      api_insert: {
        Args: { p_data: Json; p_resource: string; p_user_id: string }
        Returns: Json
      }
      api_link_contact_to_board: {
        Args: {
          p_board_ref: string
          p_contact_id: string
          p_stage_ref?: string
          p_user_id: string
        }
        Returns: Json
      }
      api_list: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_resource: string
          p_search?: string
          p_user_id: string
        }
        Returns: Json
      }
      api_update: {
        Args: {
          p_data: Json
          p_id: string
          p_resource: string
          p_user_id: string
        }
        Returns: Json
      }
      calc_contact_ranking_score: {
        Args: { p_contact_id: string }
        Returns: number
      }
      cleanup_ai_rate_limit: { Args: never; Returns: undefined }
      dispatch_webhooks: {
        Args: { p_event: string; p_payload: Json }
        Returns: undefined
      }
      generate_api_token: { Args: never; Returns: string }
      get_audit_log: {
        Args: {
          p_account_id?: string
          p_chat_id?: string
          p_date_from?: string
          p_date_to?: string
          p_event_types?: string[]
          p_limit?: number
          p_offset?: number
        }
        Returns: {
          account_id: string
          actor_id: string
          chat_id: string
          contact_id: string
          created_at: string
          event_type: string
          id: string
          new_value: Json
          old_value: Json
          total_count: number
        }[]
      }
      get_current_user_role: { Args: never; Returns: string }
      get_dashboard_atendimento: {
        Args: { p_account_id?: string }
        Returns: {
          account_id: string
          conversas_abertas: number
          conversas_finalizadas_hoje: number
          conversas_por_atendente: Json
          tempo_medio_resposta_min: number
        }[]
      }
      get_duplicate_contacts: {
        Args: never
        Returns: {
          contact_count: number
          contact_ids: string[]
          email: string
          nome: string
          whatsapp: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _module: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_user_active: { Args: { user_id: string }; Returns: boolean }
      normalize_phone: { Args: { phone_number: string }; Returns: string }
      registrar_optin_whatsapp: {
        Args: { p_contact_id: string; p_origem: string; p_valor: boolean }
        Returns: undefined
      }
      set_active_preset: {
        Args: { p_agent_id: string; p_preset_key: string }
        Returns: undefined
      }
      slugify_campo: { Args: { label: string }; Returns: string }
      unaccent: { Args: { "": string }; Returns: string }
      validate_api_token: {
        Args: { p_token: string }
        Returns: {
          token_id: string
          user_id: string
        }[]
      }
      zapi_get_webhook_secret: {
        Args: { _account_id: string }
        Returns: string
      }
      zapi_rl_bump: {
        Args: {
          _account: string
          _lockout_ms: number
          _max: number
          _user: string
          _window_ms: number
        }
        Returns: {
          locked: boolean
          retry_after_sec: number
        }[]
      }
    }
    Enums: {
      activity_type:
        | "create"
        | "update"
        | "delete"
        | "status_change"
        | "assignment"
        | "import"
        | "merge"
        | "bulk_delete"
      app_role: "admin" | "user"
      campo_personalizado_tipo:
        | "texto"
        | "numero"
        | "data"
        | "booleano"
        | "selecao"
      demand_priority: "low" | "medium" | "high"
      demand_status: "open" | "in_progress" | "resolved"
      sync_direction_type: "crm_to_google" | "google_to_crm" | "bidirectional"
      sync_status_type: "pending" | "synced" | "error" | "conflict"
      tarefa_tipo:
        | "LIGACAO"
        | "REUNIAO"
        | "VISITA"
        | "WHATSAPP"
        | "EMAIL"
        | "TAREFA"
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
    Enums: {
      activity_type: [
        "create",
        "update",
        "delete",
        "status_change",
        "assignment",
        "import",
        "merge",
        "bulk_delete",
      ],
      app_role: ["admin", "user"],
      campo_personalizado_tipo: [
        "texto",
        "numero",
        "data",
        "booleano",
        "selecao",
      ],
      demand_priority: ["low", "medium", "high"],
      demand_status: ["open", "in_progress", "resolved"],
      sync_direction_type: ["crm_to_google", "google_to_crm", "bidirectional"],
      sync_status_type: ["pending", "synced", "error", "conflict"],
      tarefa_tipo: [
        "LIGACAO",
        "REUNIAO",
        "VISITA",
        "WHATSAPP",
        "EMAIL",
        "TAREFA",
      ],
    },
  },
} as const
