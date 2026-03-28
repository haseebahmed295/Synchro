/**
 * TypeScript types for Supabase database schema
 * Generated types for type-safe database queries
 * Requirements: 2.1, 2.2
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ArtifactType = 'requirement' | 'diagram' | 'code' | 'adr'
export type LinkType = 'implements' | 'derives_from' | 'validates' | 'references'
export type AgentType = 'user' | 'analyst' | 'architect' | 'implementer' | 'judge'

export interface Database {
  public: {
    Tables: {
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          version: string
          created_at: string
          updated_at: string
          owner_id: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          version?: string
          created_at?: string
          updated_at?: string
          owner_id: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          version?: string
          created_at?: string
          updated_at?: string
          owner_id?: string
        }
      }
      artifacts: {
        Row: {
          id: string
          project_id: string
          type: ArtifactType
          content: Json
          metadata: Json
          version: number
          created_at: string
          updated_at: string
          created_by: string
        }
        Insert: {
          id?: string
          project_id: string
          type: ArtifactType
          content?: Json
          metadata?: Json
          version?: number
          created_at?: string
          updated_at?: string
          created_by: string
        }
        Update: {
          id?: string
          project_id?: string
          type?: ArtifactType
          content?: Json
          metadata?: Json
          version?: number
          created_at?: string
          updated_at?: string
          created_by?: string
        }
      }
      change_log: {
        Row: {
          id: string
          artifact_id: string
          patch: Json
          applied_at: string
          applied_by: AgentType
          agent_type: string | null
        }
        Insert: {
          id?: string
          artifact_id: string
          patch: Json
          applied_at?: string
          applied_by: AgentType
          agent_type?: string | null
        }
        Update: {
          id?: string
          artifact_id?: string
          patch?: Json
          applied_at?: string
          applied_by?: AgentType
          agent_type?: string | null
        }
      }
      traceability_links: {
        Row: {
          id: string
          source_id: string
          target_id: string
          link_type: LinkType
          confidence: number
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          source_id: string
          target_id: string
          link_type: LinkType
          confidence?: number
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          source_id?: string
          target_id?: string
          link_type?: LinkType
          confidence?: number
          created_at?: string
          created_by?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_artifact_patch: {
        Args: {
          artifact_uuid: string
          json_patch: Json
          expected_version: number
        }
        Returns: {
          success: boolean
          new_version: number | null
          error_message: string | null
        }[]
      }
      get_linked_artifacts: {
        Args: {
          artifact_uuid: string
          max_depth?: number
        }
        Returns: {
          artifact_id: string
          artifact_type: ArtifactType
          link_path: string[]
          depth: number
        }[]
      }
      detect_circular_dependencies: {
        Args: {
          project_uuid: string
          link_types?: LinkType[]
        }
        Returns: {
          cycle_path: string[]
          cycle_length: number
        }[]
      }
      calculate_traceability_coverage: {
        Args: {
          project_uuid: string
        }
        Returns: {
          total_requirements: number
          requirements_with_diagrams: number
          requirements_with_code: number
          orphaned_code_files: number
          coverage_percentage: number
        }[]
      }
      get_artifact_history: {
        Args: {
          artifact_uuid: string
          limit_count?: number
        }
        Returns: {
          change_id: string
          patch: Json
          applied_at: string
          applied_by: AgentType
          agent_type_name: string | null
        }[]
      }
      get_project_statistics: {
        Args: {
          project_uuid: string
        }
        Returns: {
          total_artifacts: number
          requirements_count: number
          diagrams_count: number
          code_count: number
          adr_count: number
          total_links: number
          last_updated: string | null
        }[]
      }
      user_has_project_access: {
        Args: {
          project_uuid: string
        }
        Returns: boolean
      }
      get_user_project_ids: {
        Args: Record<PropertyKey, never>
        Returns: string[]
      }
    }
    Enums: {
      artifact_type: ArtifactType
      link_type: LinkType
      agent_type: AgentType
    }
  }
}
