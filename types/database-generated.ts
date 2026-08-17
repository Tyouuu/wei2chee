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
    PostgrestVersion: "14.15"
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
      analysis_results: {
        Row: {
          after_workflow: Json
          before_workflow: Json
          bottlenecks: Json
          generated_at: string
          id: string
          lead_id: string
          raw_llm_response: Json
          summary: string
        }
        Insert: {
          after_workflow: Json
          before_workflow: Json
          bottlenecks: Json
          generated_at?: string
          id?: string
          lead_id: string
          raw_llm_response: Json
          summary: string
        }
        Update: {
          after_workflow?: Json
          before_workflow?: Json
          bottlenecks?: Json
          generated_at?: string
          id?: string
          lead_id?: string
          raw_llm_response?: Json
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "analysis_results_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      industries: {
        Row: {
          created_at: string
          default_workflow: Json
          has_verified_discovery: boolean
          id: string
          labels: Json
          name_en: string
          name_zh: string
          slug: string
          style_recommendation: string | null
          suggested_modules: Json
        }
        Insert: {
          created_at?: string
          default_workflow?: Json
          has_verified_discovery?: boolean
          id?: string
          labels?: Json
          name_en: string
          name_zh: string
          slug: string
          style_recommendation?: string | null
          suggested_modules?: Json
        }
        Update: {
          created_at?: string
          default_workflow?: Json
          has_verified_discovery?: boolean
          id?: string
          labels?: Json
          name_en?: string
          name_zh?: string
          slug?: string
          style_recommendation?: string | null
          suggested_modules?: Json
        }
        Relationships: []
      }
      leads: {
        Row: {
          answers: Json
          created_at: string
          id: string
          industry_id: string | null
          language: string
          style_selected: string | null
        }
        Insert: {
          answers?: Json
          created_at?: string
          id?: string
          industry_id?: string | null
          language: string
          style_selected?: string | null
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          industry_id?: string | null
          language?: string
          style_selected?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit_events: {
        Row: {
          created_at: string
          id: string
          identifier: string
        }
        Insert: {
          created_at?: string
          id?: string
          identifier: string
        }
        Update: {
          created_at?: string
          id?: string
          identifier?: string
        }
        Relationships: []
      }
      reference_cases: {
        Row: {
          anonymous_name_en: string
          anonymous_name_zh: string
          created_at: string
          highlights_en: Json
          highlights_zh: Json
          id: string
          industry_id: string
          is_verified: boolean
          modules: Json
          pain_points: Json
          source: string
          workflow: Json
        }
        Insert: {
          anonymous_name_en: string
          anonymous_name_zh: string
          created_at?: string
          highlights_en: Json
          highlights_zh: Json
          id?: string
          industry_id: string
          is_verified?: boolean
          modules?: Json
          pain_points?: Json
          source: string
          workflow?: Json
        }
        Update: {
          anonymous_name_en?: string
          anonymous_name_zh?: string
          created_at?: string
          highlights_en?: Json
          highlights_zh?: Json
          id?: string
          industry_id?: string
          is_verified?: boolean
          modules?: Json
          pain_points?: Json
          source?: string
          workflow?: Json
        }
        Relationships: [
          {
            foreignKeyName: "reference_cases_industry_id_fkey"
            columns: ["industry_id"]
            isOneToOne: false
            referencedRelation: "industries"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
