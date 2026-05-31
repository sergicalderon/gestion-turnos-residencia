export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      employees: {
        Row: {
          id: string;
          name: string;
          category: string;
          workday_percentage: number;
          start_date: string;
          end_date: string | null;
          active: boolean;
          annual_target_hours: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category: string;
          workday_percentage?: number;
          start_date: string;
          end_date?: string | null;
          active?: boolean;
          annual_target_hours?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["employees"]["Insert"]>;
        Relationships: [];
      };
      shift_types: {
        Row: {
          id: string;
          code: string;
          name: string;
          computable_hours: number;
          color: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          computable_hours?: number;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_types"]["Insert"]>;
        Relationships: [];
      };
      shift_assignments: {
        Row: {
          id: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          date: string;
          shift_type_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["shift_assignments"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "shift_assignments_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shift_assignments_shift_type_id_fkey";
            columns: ["shift_type_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
      absences: {
        Row: {
          id: string;
          employee_id: string;
          shift_type_id: string;
          start_date: string;
          end_date: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          employee_id: string;
          shift_type_id: string;
          start_date: string;
          end_date: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["absences"]["Insert"]>;
        Relationships: [
          {
            foreignKeyName: "absences_employee_id_fkey";
            columns: ["employee_id"];
            isOneToOne: false;
            referencedRelation: "employees";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "absences_shift_type_id_fkey";
            columns: ["shift_type_id"];
            isOneToOne: false;
            referencedRelation: "shift_types";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Employee = Database["public"]["Tables"]["employees"]["Row"];
export type ShiftType = Database["public"]["Tables"]["shift_types"]["Row"];
export type ShiftAssignment = Database["public"]["Tables"]["shift_assignments"]["Row"];
export type Absence = Database["public"]["Tables"]["absences"]["Row"];
