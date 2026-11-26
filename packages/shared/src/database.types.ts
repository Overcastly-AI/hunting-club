// Generated from supabase/migrations by packages/shared/scripts/gen-db-types.mjs.
// Do not edit by hand: change the SQL, then run `npm run gen:db-types -w @huntclub/shared`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      areas: {
        Row: {
          id: string;
          club_id: string;
          mesh_id: number;
          name: string;
          boundary: Json;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          mesh_id?: number;
          name: string;
          boundary: Json;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          mesh_id?: number;
          name?: string;
          boundary?: Json;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'areas_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      club_members: {
        Row: {
          id: string;
          club_id: string;
          user_id: string;
          display_name: string;
          initials: string;
          role: Database['public']['Enums']['member_role'];
          node_id: number | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          user_id: string;
          display_name: string;
          initials: string;
          role?: Database['public']['Enums']['member_role'];
          node_id?: number | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          user_id?: string;
          display_name?: string;
          initials?: string;
          role?: Database['public']['Enums']['member_role'];
          node_id?: number | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'club_members_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      club_secrets: {
        Row: {
          club_id: string;
          channel_key: string;
          key_version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          club_id: string;
          channel_key: string;
          key_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          club_id?: string;
          channel_key?: string;
          key_version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'club_secrets_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: true;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      clubs: {
        Row: {
          id: string;
          name: string;
          acreage: number | null;
          boundary: Json | null;
          region: string;
          overdue_grace_minutes: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          acreage?: number | null;
          boundary?: Json | null;
          region?: string;
          overdue_grace_minutes?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          acreage?: number | null;
          boundary?: Json | null;
          region?: string;
          overdue_grace_minutes?: number;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      harvests: {
        Row: {
          id: string;
          club_id: string;
          member_id: string;
          species: string;
          sex: Database['public']['Enums']['harvest_sex'];
          lat: number | null;
          lon: number | null;
          stand_id: string | null;
          area_id: string | null;
          notes: string | null;
          shared: boolean;
          harvested_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          member_id: string;
          species: string;
          sex?: Database['public']['Enums']['harvest_sex'];
          lat?: number | null;
          lon?: number | null;
          stand_id?: string | null;
          area_id?: string | null;
          notes?: string | null;
          shared?: boolean;
          harvested_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          member_id?: string;
          species?: string;
          sex?: Database['public']['Enums']['harvest_sex'];
          lat?: number | null;
          lon?: number | null;
          stand_id?: string | null;
          area_id?: string | null;
          notes?: string | null;
          shared?: boolean;
          harvested_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'harvests_area_id_club_id_fkey';
            columns: ['area_id', 'club_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id', 'club_id'];
          },
          {
            foreignKeyName: 'harvests_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'harvests_member_id_club_id_fkey';
            columns: ['member_id', 'club_id'];
            isOneToOne: false;
            referencedRelation: 'club_members';
            referencedColumns: ['id', 'club_id'];
          },
          {
            foreignKeyName: 'harvests_stand_id_club_id_fkey';
            columns: ['stand_id', 'club_id'];
            isOneToOne: false;
            referencedRelation: 'stands';
            referencedColumns: ['id', 'club_id'];
          },
        ];
      };
      invites: {
        Row: {
          id: string;
          club_id: string;
          token: string;
          role: Database['public']['Enums']['member_role'];
          member_expires_at: string | null;
          created_by: string | null;
          expires_at: string;
          max_uses: number | null;
          uses: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          token?: string;
          role?: Database['public']['Enums']['member_role'];
          member_expires_at?: string | null;
          created_by?: string | null;
          expires_at: string;
          max_uses?: number | null;
          uses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          token?: string;
          role?: Database['public']['Enums']['member_role'];
          member_expires_at?: string | null;
          created_by?: string | null;
          expires_at?: string;
          max_uses?: number | null;
          uses?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'invites_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      map_packs: {
        Row: {
          id: string;
          club_id: string;
          bounds: number[];
          min_zoom: number;
          max_zoom: number;
          source: string;
          s3_key: string;
          size_bytes: number;
          built_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          bounds: number[];
          min_zoom: number;
          max_zoom: number;
          source: string;
          s3_key: string;
          size_bytes: number;
          built_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          bounds?: number[];
          min_zoom?: number;
          max_zoom?: number;
          source?: string;
          s3_key?: string;
          size_bytes?: number;
          built_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'map_packs_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      plans: {
        Row: {
          id: string;
          name: string;
          member_limit: number | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          member_limit?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          member_limit?: number | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stands: {
        Row: {
          id: string;
          club_id: string;
          mesh_id: number;
          area_id: string | null;
          name: string;
          type: Database['public']['Enums']['stand_type'];
          lat: number;
          lon: number;
          notes: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          mesh_id?: number;
          area_id?: string | null;
          name: string;
          type: Database['public']['Enums']['stand_type'];
          lat: number;
          lon: number;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          mesh_id?: number;
          area_id?: string | null;
          name?: string;
          type?: Database['public']['Enums']['stand_type'];
          lat?: number;
          lon?: number;
          notes?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'stands_area_id_club_id_fkey';
            columns: ['area_id', 'club_id'];
            isOneToOne: false;
            referencedRelation: 'areas';
            referencedColumns: ['id', 'club_id'];
          },
          {
            foreignKeyName: 'stands_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: false;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_events: {
        Row: {
          event_id: string;
          processed_at: string;
        };
        Insert: {
          event_id: string;
          processed_at?: string;
        };
        Update: {
          event_id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          club_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          plan_id: string;
          status: Database['public']['Enums']['subscription_status'];
          paid_through: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          club_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string;
          plan_id: string;
          status: Database['public']['Enums']['subscription_status'];
          paid_through?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          club_id?: string;
          stripe_customer_id?: string;
          stripe_subscription_id?: string;
          plan_id?: string;
          status?: Database['public']['Enums']['subscription_status'];
          paid_through?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'subscriptions_club_id_fkey';
            columns: ['club_id'];
            isOneToOne: true;
            referencedRelation: 'clubs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'subscriptions_plan_id_fkey';
            columns: ['plan_id'];
            isOneToOne: false;
            referencedRelation: 'plans';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      redeem_invite: {
        Args: { invite_token: string; display_name: string; initials: string };
        Returns: Database['public']['Tables']['club_members']['Row'];
      };
    };
    Enums: {
      harvest_sex: 'male' | 'female' | 'unknown';
      member_role: 'admin' | 'member' | 'guest';
      redeem_invite_error:
        | 'not_authenticated'
        | 'invite_not_found'
        | 'invite_expired'
        | 'invite_used_up'
        | 'club_inactive'
        | 'club_full';
      stand_type: 'tree_stand' | 'ladder' | 'ground_blind';
      subscription_status:
        | 'incomplete'
        | 'incomplete_expired'
        | 'trialing'
        | 'active'
        | 'past_due'
        | 'unpaid'
        | 'canceled'
        | 'paused';
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export const Constants = {
  public: {
    Enums: {
      harvest_sex: ['male', 'female', 'unknown'],
      member_role: ['admin', 'member', 'guest'],
      redeem_invite_error: [
        'not_authenticated',
        'invite_not_found',
        'invite_expired',
        'invite_used_up',
        'club_inactive',
        'club_full',
      ],
      stand_type: ['tree_stand', 'ladder', 'ground_blind'],
      subscription_status: [
        'incomplete',
        'incomplete_expired',
        'trialing',
        'active',
        'past_due',
        'unpaid',
        'canceled',
        'paused',
      ],
    },
  },
} as const;
