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
          politician_name: string
          politician_photo_url: string | null
          primary_color: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          mandate_name?: string
          politician_name?: string
          politician_photo_url?: string | null
          primary_color?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          mandate_name?: string
          politician_name?: string
          politician_photo_url?: string | null
          primary_color?: string
          updated_at?: string
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
          origem: string | null
          pin_color: string | null
          profissao: string | null
          ranking: number | null
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
          origem?: string | null
          pin_color?: string | null
          profissao?: string | null
          ranking?: number | null
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
          origem?: string | null
          pin_color?: string | null
          profissao?: string | null
          ranking?: number | null
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
          status_aprovacao: string
          telefone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: string
          status_aprovacao?: string
          telefone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: string
          status_aprovacao?: string
          telefone?: string | null
        }
        Relationships: []
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
          response: string | null
          status_code: number | null
          webhook_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          response?: string | null
          status_code?: number | null
          webhook_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_token: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
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
      is_user_active: { Args: { user_id: string }; Returns: boolean }
      normalize_phone: { Args: { phone_number: string }; Returns: string }
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
