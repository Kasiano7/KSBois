export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          access_notes: string | null
          allow_unattended_delivery: boolean
          city: string
          company_id: string
          created_at: string
          customer_id: string
          first_name: string | null
          has_gate: boolean
          has_slope: boolean
          id: string
          insee_code: string | null
          is_default: boolean
          label: string | null
          last_name: string | null
          lat: number | null
          line1: string
          line2: string | null
          lng: number | null
          phone: string | null
          postal_code: string
          truck_access: string
          unload_type: string | null
        }
        Insert: {
          access_notes?: string | null
          allow_unattended_delivery?: boolean
          city: string
          company_id: string
          created_at?: string
          customer_id: string
          first_name?: string | null
          has_gate?: boolean
          has_slope?: boolean
          id?: string
          insee_code?: string | null
          is_default?: boolean
          label?: string | null
          last_name?: string | null
          lat?: number | null
          line1: string
          line2?: string | null
          lng?: number | null
          phone?: string | null
          postal_code: string
          truck_access?: string
          unload_type?: string | null
        }
        Update: {
          access_notes?: string | null
          allow_unattended_delivery?: boolean
          city?: string
          company_id?: string
          created_at?: string
          customer_id?: string
          first_name?: string | null
          has_gate?: boolean
          has_slope?: boolean
          id?: string
          insee_code?: string | null
          is_default?: boolean
          label?: string | null
          last_name?: string | null
          lat?: number | null
          line1?: string
          line2?: string | null
          lng?: number | null
          phone?: string | null
          postal_code?: string
          truck_access?: string
          unload_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_events: {
        Row: {
          cart_id: string | null
          company_id: string
          event_type: string
          id: string
          metadata: Json
          occurred_at: string
          order_id: string | null
          potential_revenue_cents: number | null
          potential_volume_m3: number | null
          quote_request_id: string | null
          reason: string | null
          session_id: string
          variant_id: string | null
          zone_id: string | null
        }
        Insert: {
          cart_id?: string | null
          company_id: string
          event_type: string
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          potential_revenue_cents?: number | null
          potential_volume_m3?: number | null
          quote_request_id?: string | null
          reason?: string | null
          session_id: string
          variant_id?: string | null
          zone_id?: string | null
        }
        Update: {
          cart_id?: string | null
          company_id?: string
          event_type?: string
          id?: string
          metadata?: Json
          occurred_at?: string
          order_id?: string | null
          potential_revenue_cents?: number | null
          potential_volume_m3?: number | null
          quote_request_id?: string | null
          reason?: string | null
          session_id?: string
          variant_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_quote_request_id_fkey"
            columns: ["quote_request_id"]
            isOneToOne: false
            referencedRelation: "quote_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_sessions: {
        Row: {
          acquisition_source: string
          campaign: string | null
          company_id: string
          id: string
          landing_path: string | null
          last_seen_at: string
          referrer_host: string | null
          started_at: string
        }
        Insert: {
          acquisition_source?: string
          campaign?: string | null
          company_id: string
          id?: string
          landing_path?: string | null
          last_seen_at?: string
          referrer_host?: string | null
          started_at?: string
        }
        Update: {
          acquisition_source?: string
          campaign?: string | null
          company_id?: string
          id?: string
          landing_path?: string | null
          last_seen_at?: string
          referrer_host?: string | null
          started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_sessions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          after: Json | null
          before: Json | null
          company_id: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip: unknown
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          company_id: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip?: unknown
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          after?: Json | null
          before?: Json | null
          company_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip?: unknown
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          cart_id: string
          created_at: string
          id: string
          quantity: number
          variant_id: string
        }
        Insert: {
          cart_id: string
          created_at?: string
          id?: string
          quantity: number
          variant_id: string
        }
        Update: {
          cart_id?: string
          created_at?: string
          id?: string
          quantity?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey"
            columns: ["cart_id"]
            isOneToOne: false
            referencedRelation: "carts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cart_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      carts: {
        Row: {
          access_notes: string | null
          address_line1: string | null
          address_line2: string | null
          allow_unattended_delivery: boolean
          city: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          delivery_notes: string | null
          email: string | null
          first_name: string | null
          fulfillment_type: string
          id: string
          last_name: string | null
          phone: string | null
          postal_code: string | null
          slot_id: string | null
          step: string
          truck_access: string
          unload_type: string | null
          updated_at: string
        }
        Insert: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_unattended_delivery?: boolean
          city?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          delivery_notes?: string | null
          email?: string | null
          first_name?: string | null
          fulfillment_type?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slot_id?: string | null
          step?: string
          truck_access?: string
          unload_type?: string | null
          updated_at?: string
        }
        Update: {
          access_notes?: string | null
          address_line1?: string | null
          address_line2?: string | null
          allow_unattended_delivery?: boolean
          city?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          delivery_notes?: string | null
          email?: string | null
          first_name?: string | null
          fulfillment_type?: string
          id?: string
          last_name?: string | null
          phone?: string | null
          postal_code?: string | null
          slot_id?: string | null
          step?: string
          truck_access?: string
          unload_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "carts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carts_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address_line1: string | null
          ape_code: string | null
          city: string | null
          created_at: string
          currency: string
          depot_lat: number | null
          depot_lng: number | null
          email: string
          id: string
          is_active: boolean
          legal_name: string | null
          name: string
          phone: string | null
          phone_display: string | null
          postal_code: string | null
          pricing_basis: string
          rcs: string | null
          siret: string | null
          slug: string
          timezone: string
          updated_at: string
          vat_mode: string
          vat_number: string | null
        }
        Insert: {
          address_line1?: string | null
          ape_code?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          depot_lat?: number | null
          depot_lng?: number | null
          email: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name: string
          phone?: string | null
          phone_display?: string | null
          postal_code?: string | null
          pricing_basis?: string
          rcs?: string | null
          siret?: string | null
          slug: string
          timezone?: string
          updated_at?: string
          vat_mode?: string
          vat_number?: string | null
        }
        Update: {
          address_line1?: string | null
          ape_code?: string | null
          city?: string | null
          created_at?: string
          currency?: string
          depot_lat?: number | null
          depot_lng?: number | null
          email?: string
          id?: string
          is_active?: boolean
          legal_name?: string | null
          name?: string
          phone?: string | null
          phone_display?: string | null
          postal_code?: string | null
          pricing_basis?: string
          rcs?: string | null
          siret?: string | null
          slug?: string
          timezone?: string
          updated_at?: string
          vat_mode?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      company_domains: {
        Row: {
          company_id: string
          created_at: string
          hostname: string
          id: string
          is_primary: boolean
        }
        Insert: {
          company_id: string
          created_at?: string
          hostname: string
          id?: string
          is_primary?: boolean
        }
        Update: {
          company_id?: string
          created_at?: string
          hostname?: string
          id?: string
          is_primary?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_features: {
        Row: {
          blog: boolean
          company_id: string
          fuel_surcharge: boolean
          kindling: boolean
          needs_calculator: boolean
          nets: boolean
          pallets: boolean
          pellets: boolean
          pickup: boolean
          promotions: boolean
          quotes: boolean
          route_optimization: boolean
          services: boolean
          sms: boolean
        }
        Insert: {
          blog?: boolean
          company_id: string
          fuel_surcharge?: boolean
          kindling?: boolean
          needs_calculator?: boolean
          nets?: boolean
          pallets?: boolean
          pellets?: boolean
          pickup?: boolean
          promotions?: boolean
          quotes?: boolean
          route_optimization?: boolean
          services?: boolean
          sms?: boolean
        }
        Update: {
          blog?: boolean
          company_id?: string
          fuel_surcharge?: boolean
          kindling?: boolean
          needs_calculator?: boolean
          nets?: boolean
          pallets?: boolean
          pellets?: boolean
          pickup?: boolean
          promotions?: boolean
          quotes?: boolean
          route_optimization?: boolean
          services?: boolean
          sms?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "company_features_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_members: {
        Row: {
          company_id: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          company_id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          company_id: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          company_id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      company_themes: {
        Row: {
          company_id: string
          favicon_media_id: string | null
          font_body: string
          font_display: string
          logo_dark_media_id: string | null
          logo_media_id: string | null
          tokens: Json
          updated_at: string
        }
        Insert: {
          company_id: string
          favicon_media_id?: string | null
          font_body?: string
          font_display?: string
          logo_dark_media_id?: string | null
          logo_media_id?: string | null
          tokens?: Json
          updated_at?: string
        }
        Update: {
          company_id?: string
          favicon_media_id?: string | null
          font_body?: string
          font_display?: string
          logo_dark_media_id?: string | null
          logo_media_id?: string | null
          tokens?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_themes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: true
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_themes_favicon_fk"
            columns: ["favicon_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_themes_logo_dark_fk"
            columns: ["logo_dark_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "company_themes_logo_fk"
            columns: ["logo_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          accepts_marketing: boolean
          company_id: string
          company_name: string | null
          created_at: string
          customer_type: string
          email: string
          first_name: string | null
          id: string
          internal_notes: string | null
          is_blocked: boolean
          is_company: boolean
          last_name: string | null
          phone: string | null
          siret: string | null
          total_orders: number
          total_spent_cents: number
          updated_at: string
          user_id: string | null
          vat_number: string | null
        }
        Insert: {
          accepts_marketing?: boolean
          company_id: string
          company_name?: string | null
          created_at?: string
          customer_type?: string
          email: string
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          is_blocked?: boolean
          is_company?: boolean
          last_name?: string | null
          phone?: string | null
          siret?: string | null
          total_orders?: number
          total_spent_cents?: number
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
        }
        Update: {
          accepts_marketing?: boolean
          company_id?: string
          company_name?: string | null
          created_at?: string
          customer_type?: string
          email?: string
          first_name?: string | null
          id?: string
          internal_notes?: string | null
          is_blocked?: boolean
          is_company?: boolean
          last_name?: string | null
          phone?: string | null
          siret?: string | null
          total_orders?: number
          total_spent_cents?: number
          updated_at?: string
          user_id?: string | null
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cut_lengths: {
        Row: {
          cm: number
          company_id: string
          hint: string | null
          id: string
          is_active: boolean
          label: string
          sort_order: number
          stacking_coefficient: number
        }
        Insert: {
          cm: number
          company_id: string
          hint?: string | null
          id?: string
          is_active?: boolean
          label: string
          sort_order?: number
          stacking_coefficient: number
        }
        Update: {
          cm?: number
          company_id?: string
          hint?: string | null
          id?: string
          is_active?: boolean
          label?: string
          sort_order?: number
          stacking_coefficient?: number
        }
        Relationships: [
          {
            foreignKeyName: "cut_lengths_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_slots: {
        Row: {
          booked_deliveries: number
          booked_volume_m3: number
          closed_by_blackout_id: string | null
          closed_reason: string | null
          company_id: string
          date: string
          end_time: string
          id: string
          is_open: boolean
          label: string
          max_deliveries: number
          max_volume_m3: number
          start_time: string
          template_id: string | null
          vehicle_id: string | null
          zone_ids: string[]
        }
        Insert: {
          booked_deliveries?: number
          booked_volume_m3?: number
          closed_by_blackout_id?: string | null
          closed_reason?: string | null
          company_id: string
          date: string
          end_time: string
          id?: string
          is_open?: boolean
          label: string
          max_deliveries: number
          max_volume_m3: number
          start_time: string
          template_id?: string | null
          vehicle_id?: string | null
          zone_ids?: string[]
        }
        Update: {
          booked_deliveries?: number
          booked_volume_m3?: number
          closed_by_blackout_id?: string | null
          closed_reason?: string | null
          company_id?: string
          date?: string
          end_time?: string
          id?: string
          is_open?: boolean
          label?: string
          max_deliveries?: number
          max_volume_m3?: number
          start_time?: string
          template_id?: string | null
          vehicle_id?: string | null
          zone_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "delivery_slots_closed_by_blackout_id_fkey"
            columns: ["closed_by_blackout_id"]
            isOneToOne: false
            referencedRelation: "slot_blackouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_slots_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "slot_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_slots_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          base_fee_cents: number
          color: string | null
          company_id: string
          created_at: string
          delivery_days: number[]
          distance_km_estimate: number | null
          fee_per_m3_cents: number
          free_above_cents: number | null
          id: string
          is_active: boolean
          lead_time_days: number | null
          min_order_amount_cents: number
          min_order_volume_m3: number
          name: string
          sort_order: number
        }
        Insert: {
          base_fee_cents?: number
          color?: string | null
          company_id: string
          created_at?: string
          delivery_days?: number[]
          distance_km_estimate?: number | null
          fee_per_m3_cents?: number
          free_above_cents?: number | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          min_order_amount_cents?: number
          min_order_volume_m3?: number
          name: string
          sort_order?: number
        }
        Update: {
          base_fee_cents?: number
          color?: string | null
          company_id?: string
          created_at?: string
          delivery_days?: number[]
          distance_km_estimate?: number | null
          fee_per_m3_cents?: number
          free_above_cents?: number | null
          id?: string
          is_active?: boolean
          lead_time_days?: number | null
          min_order_amount_cents?: number
          min_order_volume_m3?: number
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      document_sequences: {
        Row: {
          company_id: string
          kind: string
          last_value: number
          year: number
        }
        Insert: {
          company_id: string
          kind: string
          last_value?: number
          year: number
        }
        Update: {
          company_id?: string
          kind?: string
          last_value?: number
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "document_sequences_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      fuel_prices: {
        Row: {
          applied: boolean
          company_id: string
          department: string | null
          fuel_type: string
          id: string
          price_per_liter_cents: number
          recorded_at: string
          rejected_reason: string | null
          sample_size: number | null
          source: string
        }
        Insert: {
          applied?: boolean
          company_id: string
          department?: string | null
          fuel_type?: string
          id?: string
          price_per_liter_cents: number
          recorded_at?: string
          rejected_reason?: string | null
          sample_size?: number | null
          source: string
        }
        Update: {
          applied?: boolean
          company_id?: string
          department?: string | null
          fuel_type?: string
          id?: string
          price_per_liter_cents?: number
          recorded_at?: string
          rejected_reason?: string | null
          sample_size?: number | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "fuel_prices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          buyer: Json
          company_id: string
          created_at: string
          id: string
          is_credit_note: boolean
          issued_at: string
          lines: Json
          number: string
          order_id: string
          parent_invoice_id: string | null
          seller: Json
          storage_path: string | null
          totals: Json
          vat_breakdown: Json
        }
        Insert: {
          buyer: Json
          company_id: string
          created_at?: string
          id?: string
          is_credit_note?: boolean
          issued_at?: string
          lines: Json
          number: string
          order_id: string
          parent_invoice_id?: string | null
          seller: Json
          storage_path?: string | null
          totals: Json
          vat_breakdown?: Json
        }
        Update: {
          buyer?: Json
          company_id?: string
          created_at?: string
          id?: string
          is_credit_note?: boolean
          issued_at?: string
          lines?: Json
          number?: string
          order_id?: string
          parent_invoice_id?: string | null
          seller?: Json
          storage_path?: string | null
          totals?: Json
          vat_breakdown?: Json
        }
        Relationships: [
          {
            foreignKeyName: "invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string | null
          caption: string | null
          company_id: string
          created_at: string
          created_by: string | null
          credit: string | null
          duration_seconds: number | null
          file_name: string
          file_path: string
          folder: string | null
          height: number | null
          id: string
          imagekit_file_id: string
          lqip: string | null
          media_type: string
          mime: string | null
          size_bytes: number | null
          tags: string[]
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          caption?: string | null
          company_id: string
          created_at?: string
          created_by?: string | null
          credit?: string | null
          duration_seconds?: number | null
          file_name: string
          file_path: string
          folder?: string | null
          height?: number | null
          id?: string
          imagekit_file_id: string
          lqip?: string | null
          media_type: string
          mime?: string | null
          size_bytes?: number | null
          tags?: string[]
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          caption?: string | null
          company_id?: string
          created_at?: string
          created_by?: string | null
          credit?: string | null
          duration_seconds?: number | null
          file_name?: string
          file_path?: string
          folder?: string | null
          height?: number | null
          id?: string
          imagekit_file_id?: string
          lqip?: string | null
          media_type?: string
          mime?: string | null
          size_bytes?: number | null
          tags?: string[]
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications_log: {
        Row: {
          channel: string
          company_id: string
          created_at: string
          error: string | null
          id: string
          order_id: string | null
          provider_id: string | null
          recipient: string
          sent_at: string | null
          status: string
          template: string
        }
        Insert: {
          channel: string
          company_id: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          provider_id?: string | null
          recipient: string
          sent_at?: string | null
          status: string
          template: string
        }
        Update: {
          channel?: string
          company_id?: string
          created_at?: string
          error?: string | null
          id?: string
          order_id?: string | null
          provider_id?: string | null
          recipient?: string
          sent_at?: string | null
          status?: string
          template?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_log_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          order_id: string
          token: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          order_id: string
          token: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          order_id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_access_tokens_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          company_id: string
          cut_length_cm: number | null
          humidity_class: string | null
          id: string
          is_backorder: boolean
          line_total_cents: number
          line_volume_m3: number
          order_id: string
          packaging: string | null
          product_name: string
          quantity: number
          sku: string
          species_label: string | null
          unit: string
          unit_price_cents: number
          unit_volume_m3: number
          variant_id: string | null
          variant_label: string
          vat_rate: number
        }
        Insert: {
          company_id: string
          cut_length_cm?: number | null
          humidity_class?: string | null
          id?: string
          is_backorder?: boolean
          line_total_cents: number
          line_volume_m3: number
          order_id: string
          packaging?: string | null
          product_name: string
          quantity: number
          sku: string
          species_label?: string | null
          unit: string
          unit_price_cents: number
          unit_volume_m3: number
          variant_id?: string | null
          variant_label: string
          vat_rate: number
        }
        Update: {
          company_id?: string
          cut_length_cm?: number | null
          humidity_class?: string | null
          id?: string
          is_backorder?: boolean
          line_total_cents?: number
          line_volume_m3?: number
          order_id?: string
          packaging?: string | null
          product_name?: string
          quantity?: number
          sku?: string
          species_label?: string | null
          unit?: string
          unit_price_cents?: number
          unit_volume_m3?: number
          variant_id?: string | null
          variant_label?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      order_option_items: {
        Row: {
          company_id: string
          id: string
          name: string
          option_id: string | null
          order_id: string
          price_cents: number
          vat_rate: number
        }
        Insert: {
          company_id: string
          id?: string
          name: string
          option_id?: string | null
          order_id: string
          price_cents: number
          vat_rate?: number
        }
        Update: {
          company_id?: string
          id?: string
          name?: string
          option_id?: string | null
          order_id?: string
          price_cents?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_option_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_option_items_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "product_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_option_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_history: {
        Row: {
          actor: string
          changed_by: string | null
          company_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          order_id: string
          to_status: string
        }
        Insert: {
          actor?: string
          changed_by?: string | null
          company_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id: string
          to_status: string
        }
        Update: {
          actor?: string
          changed_by?: string | null
          company_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          order_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          acquisition_source: string | null
          amount_paid_cents: number
          analytics_session_id: string | null
          cgv_accepted_at: string | null
          cgv_version: string | null
          company_id: string
          confirmed_delivery_date: string | null
          confirmed_slot_label: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          delivery_base_cents: number
          delivery_fuel_cents: number
          delivery_notes: string | null
          delivery_offered_cents: number
          delivery_total_cents: number
          delivery_volume_cents: number
          deposit_required_cents: number
          discount_cents: number
          distance_km: number | null
          email: string
          first_name: string | null
          fuel_price_snapshot_cents: number | null
          fulfillment_type: string
          id: string
          internal_notes: string | null
          is_guest: boolean
          last_name: string | null
          options_cents: number
          payment_method: string | null
          payment_status: string
          phone: string | null
          pricing_snapshot: Json | null
          promotion_code: string | null
          promotion_id: string | null
          quote_pdf_before_order: boolean
          reference: string
          requested_slot_label: string | null
          route_position: number | null
          shipping_address: Json | null
          slot_id: string | null
          source: string
          status: string
          subtotal_cents: number
          total_cents: number
          total_volume_m3: number
          updated_at: string
          vat_breakdown: Json
          vehicle_id: string | null
          zone_id: string | null
        }
        Insert: {
          acquisition_source?: string | null
          amount_paid_cents?: number
          analytics_session_id?: string | null
          cgv_accepted_at?: string | null
          cgv_version?: string | null
          company_id: string
          confirmed_delivery_date?: string | null
          confirmed_slot_label?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_base_cents?: number
          delivery_fuel_cents?: number
          delivery_notes?: string | null
          delivery_offered_cents?: number
          delivery_total_cents?: number
          delivery_volume_cents?: number
          deposit_required_cents?: number
          discount_cents?: number
          distance_km?: number | null
          email: string
          first_name?: string | null
          fuel_price_snapshot_cents?: number | null
          fulfillment_type?: string
          id?: string
          internal_notes?: string | null
          is_guest?: boolean
          last_name?: string | null
          options_cents?: number
          payment_method?: string | null
          payment_status?: string
          phone?: string | null
          pricing_snapshot?: Json | null
          promotion_code?: string | null
          promotion_id?: string | null
          quote_pdf_before_order?: boolean
          reference: string
          requested_slot_label?: string | null
          route_position?: number | null
          shipping_address?: Json | null
          slot_id?: string | null
          source?: string
          status?: string
          subtotal_cents?: number
          total_cents?: number
          total_volume_m3?: number
          updated_at?: string
          vat_breakdown?: Json
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Update: {
          acquisition_source?: string | null
          amount_paid_cents?: number
          analytics_session_id?: string | null
          cgv_accepted_at?: string | null
          cgv_version?: string | null
          company_id?: string
          confirmed_delivery_date?: string | null
          confirmed_slot_label?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          delivery_base_cents?: number
          delivery_fuel_cents?: number
          delivery_notes?: string | null
          delivery_offered_cents?: number
          delivery_total_cents?: number
          delivery_volume_cents?: number
          deposit_required_cents?: number
          discount_cents?: number
          distance_km?: number | null
          email?: string
          first_name?: string | null
          fuel_price_snapshot_cents?: number | null
          fulfillment_type?: string
          id?: string
          internal_notes?: string | null
          is_guest?: boolean
          last_name?: string | null
          options_cents?: number
          payment_method?: string | null
          payment_status?: string
          phone?: string | null
          pricing_snapshot?: Json | null
          promotion_code?: string | null
          promotion_id?: string | null
          quote_pdf_before_order?: boolean
          reference?: string
          requested_slot_label?: string | null
          route_position?: number | null
          shipping_address?: Json | null
          slot_id?: string | null
          source?: string
          status?: string
          subtotal_cents?: number
          total_cents?: number
          total_volume_m3?: number
          updated_at?: string
          vat_breakdown?: Json
          vehicle_id?: string | null
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_analytics_session_id_fkey"
            columns: ["analytics_session_id"]
            isOneToOne: false
            referencedRelation: "analytics_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_promotion_id_fkey"
            columns: ["promotion_id"]
            isOneToOne: false
            referencedRelation: "promotions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "delivery_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          company_id: string
          created_at: string
          id: string
          kind: string
          method: string
          notes: string | null
          order_id: string
          received_at: string | null
          recorded_by: string | null
          reference: string | null
          status: string
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_cents: number
          company_id: string
          created_at?: string
          id?: string
          kind?: string
          method: string
          notes?: string | null
          order_id: string
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
          status: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_cents?: number
          company_id?: string
          created_at?: string
          id?: string
          kind?: string
          method?: string
          notes?: string | null
          order_id?: string
          received_at?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: string
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      price_tiers: {
        Row: {
          company_id: string
          id: string
          min_quantity: number
          sort_order: number
          unit_price_cents: number
          variant_id: string
        }
        Insert: {
          company_id: string
          id?: string
          min_quantity: number
          sort_order?: number
          unit_price_cents: number
          variant_id: string
        }
        Update: {
          company_id?: string
          id?: string
          min_quantity?: number
          sort_order?: number
          unit_price_cents?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_tiers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_tiers_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      processed_webhook_events: {
        Row: {
          event_id: string
          processed_at: string
          provider: string
        }
        Insert: {
          event_id: string
          processed_at?: string
          provider?: string
        }
        Update: {
          event_id?: string
          processed_at?: string
          provider?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          company_id: string
          description: string | null
          hero_media_id: string | null
          id: string
          is_active: boolean
          name: string
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
        }
        Insert: {
          company_id: string
          description?: string | null
          hero_media_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
        }
        Update: {
          company_id?: string
          description?: string | null
          hero_media_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_hero_fk"
            columns: ["hero_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media: {
        Row: {
          is_primary: boolean
          media_id: string
          product_id: string
          sort_order: number
          variant_id: string | null
        }
        Insert: {
          is_primary?: boolean
          media_id: string
          product_id: string
          sort_order?: number
          variant_id?: string | null
        }
        Update: {
          is_primary?: boolean
          media_id?: string
          product_id?: string
          sort_order?: number
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_options: {
        Row: {
          applies_to: string
          code: string
          company_id: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number
          price_type: string
          sort_order: number
          vat_rate: number
        }
        Insert: {
          applies_to?: string
          code: string
          company_id: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number
          price_type?: string
          sort_order?: number
          vat_rate?: number
        }
        Update: {
          applies_to?: string
          code?: string
          company_id?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number
          price_type?: string
          sort_order?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_options_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          allow_backorder: boolean
          backorder_available_at: string | null
          base_price_cents: number
          batch_label: string | null
          company_id: string
          compare_at_price_cents: number | null
          created_at: string
          cut_length_id: string | null
          humidity_class: string | null
          id: string
          is_active: boolean
          low_stock_threshold: number
          max_quantity: number | null
          measured_at: string | null
          measured_humidity_pct: number | null
          min_quantity: number
          packaging: string
          product_id: string
          quantity_step: number
          sku: string
          sort_order: number
          stock_available: number | null
          stock_on_hand: number
          stock_reserved: number
          track_stock: boolean
          unit: string
          unit_volume_m3: number
          unit_weight_kg: number | null
          updated_at: string
          vat_rate: number
        }
        Insert: {
          allow_backorder?: boolean
          backorder_available_at?: string | null
          base_price_cents: number
          batch_label?: string | null
          company_id: string
          compare_at_price_cents?: number | null
          created_at?: string
          cut_length_id?: string | null
          humidity_class?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          max_quantity?: number | null
          measured_at?: string | null
          measured_humidity_pct?: number | null
          min_quantity?: number
          packaging?: string
          product_id: string
          quantity_step?: number
          sku: string
          sort_order?: number
          stock_available?: number | null
          stock_on_hand?: number
          stock_reserved?: number
          track_stock?: boolean
          unit?: string
          unit_volume_m3?: number
          unit_weight_kg?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Update: {
          allow_backorder?: boolean
          backorder_available_at?: string | null
          base_price_cents?: number
          batch_label?: string | null
          company_id?: string
          compare_at_price_cents?: number | null
          created_at?: string
          cut_length_id?: string | null
          humidity_class?: string | null
          id?: string
          is_active?: boolean
          low_stock_threshold?: number
          max_quantity?: number | null
          measured_at?: string | null
          measured_humidity_pct?: number | null
          min_quantity?: number
          packaging?: string
          product_id?: string
          quantity_step?: number
          sku?: string
          sort_order?: number
          stock_available?: number | null
          stock_on_hand?: number
          stock_reserved?: number
          track_stock?: boolean
          unit?: string
          unit_volume_m3?: number
          unit_weight_kg?: number | null
          updated_at?: string
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_cut_length_id_fkey"
            columns: ["cut_length_id"]
            isOneToOne: false
            referencedRelation: "cut_lengths"
            referencedColumns: ["id"]
          },
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
          badges: string[]
          category_id: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_featured: boolean
          name: string
          product_type: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          slug: string
          sort_order: number
          species_ids: string[]
          updated_at: string
        }
        Insert: {
          badges?: string[]
          category_id?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name: string
          product_type?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug: string
          sort_order?: number
          species_ids?: string[]
          updated_at?: string
        }
        Update: {
          badges?: string[]
          category_id?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_featured?: boolean
          name?: string
          product_type?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          slug?: string
          sort_order?: number
          species_ids?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      promotions: {
        Row: {
          applies_to_variant_ids: string[]
          code: string
          company_id: string
          created_at: string
          discount_type: string
          discount_value: number
          ends_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          max_uses_per_customer: number
          min_order_cents: number
          min_volume_m3: number
          name: string | null
          starts_at: string | null
          used_count: number
        }
        Insert: {
          applies_to_variant_ids?: string[]
          code: string
          company_id: string
          created_at?: string
          discount_type: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number
          min_order_cents?: number
          min_volume_m3?: number
          name?: string | null
          starts_at?: string | null
          used_count?: number
        }
        Update: {
          applies_to_variant_ids?: string[]
          code?: string
          company_id?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          ends_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          max_uses_per_customer?: number
          min_order_cents?: number
          min_volume_m3?: number
          name?: string | null
          starts_at?: string | null
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "promotions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_requests: {
        Row: {
          address_line1: string | null
          admin_notes: string | null
          cart_snapshot: Json | null
          city: string | null
          company_id: string
          company_name: string | null
          converted_order_id: string | null
          created_at: string
          cut_length_cm: number | null
          delivery_cents: number | null
          delivery_included: boolean
          discount_cents: number
          discount_label: string | null
          email: string
          estimated_total_cents: number | null
          first_name: string | null
          humidity_preference: string | null
          id: string
          last_name: string | null
          message: string | null
          origin: string
          phone: string | null
          postal_code: string | null
          proposal_lines: Json
          quantity_m3: number | null
          reference: string
          responded_at: string | null
          species: string | null
          status: string
          valid_until: string | null
        }
        Insert: {
          address_line1?: string | null
          admin_notes?: string | null
          cart_snapshot?: Json | null
          city?: string | null
          company_id: string
          company_name?: string | null
          converted_order_id?: string | null
          created_at?: string
          cut_length_cm?: number | null
          delivery_cents?: number | null
          delivery_included?: boolean
          discount_cents?: number
          discount_label?: string | null
          email: string
          estimated_total_cents?: number | null
          first_name?: string | null
          humidity_preference?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          origin?: string
          phone?: string | null
          postal_code?: string | null
          proposal_lines?: Json
          quantity_m3?: number | null
          reference: string
          responded_at?: string | null
          species?: string | null
          status?: string
          valid_until?: string | null
        }
        Update: {
          address_line1?: string | null
          admin_notes?: string | null
          cart_snapshot?: Json | null
          city?: string | null
          company_id?: string
          company_name?: string | null
          converted_order_id?: string | null
          created_at?: string
          cut_length_cm?: number | null
          delivery_cents?: number | null
          delivery_included?: boolean
          discount_cents?: number
          discount_label?: string | null
          email?: string
          estimated_total_cents?: number | null
          first_name?: string | null
          humidity_preference?: string | null
          id?: string
          last_name?: string | null
          message?: string | null
          origin?: string
          phone?: string | null
          postal_code?: string | null
          proposal_lines?: Json
          quantity_m3?: number | null
          reference?: string
          responded_at?: string | null
          species?: string | null
          status?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_requests_converted_order_id_fkey"
            columns: ["converted_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_blackouts: {
        Row: {
          applies_to_zone_ids: string[]
          company_id: string
          end_date: string
          id: string
          reason: string | null
          start_date: string
        }
        Insert: {
          applies_to_zone_ids?: string[]
          company_id: string
          end_date: string
          id?: string
          reason?: string | null
          start_date: string
        }
        Update: {
          applies_to_zone_ids?: string[]
          company_id?: string
          end_date?: string
          id?: string
          reason?: string | null
          start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "slot_blackouts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      slot_templates: {
        Row: {
          company_id: string
          end_time: string
          id: string
          is_active: boolean
          label: string
          max_deliveries: number
          max_volume_m3: number
          start_time: string
          vehicle_id: string | null
          weekday: number
          zone_ids: string[]
        }
        Insert: {
          company_id: string
          end_time: string
          id?: string
          is_active?: boolean
          label: string
          max_deliveries?: number
          max_volume_m3?: number
          start_time: string
          vehicle_id?: string | null
          weekday: number
          zone_ids?: string[]
        }
        Update: {
          company_id?: string
          end_time?: string
          id?: string
          is_active?: boolean
          label?: string
          max_deliveries?: number
          max_volume_m3?: number
          start_time?: string
          vehicle_id?: string | null
          weekday?: number
          zone_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "slot_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slot_templates_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_alerts: {
        Row: {
          company_id: string
          created_at: string
          email: string
          id: string
          notified_at: string | null
          variant_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          email: string
          id?: string
          notified_at?: string | null
          variant_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          notified_at?: string | null
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_alerts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_alerts_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          order_id: string | null
          quantity: number
          reason: string | null
          stock_after: number
          variant_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          order_id?: string | null
          quantity: number
          reason?: string | null
          stock_after: number
          variant_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          order_id?: string | null
          quantity?: number
          reason?: string | null
          stock_after?: number
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          capacity_m3: number
          capacity_pallets: number | null
          company_id: string
          cost_per_km_cents: number
          created_at: string
          fuel_consumption_l_per_100km: number
          id: string
          is_active: boolean
          max_distance_km: number | null
          name: string
          sort_order: number
          vehicle_type: string
        }
        Insert: {
          capacity_m3: number
          capacity_pallets?: number | null
          company_id: string
          cost_per_km_cents?: number
          created_at?: string
          fuel_consumption_l_per_100km?: number
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          name: string
          sort_order?: number
          vehicle_type: string
        }
        Update: {
          capacity_m3?: number
          capacity_pallets?: number | null
          company_id?: string
          cost_per_km_cents?: number
          created_at?: string
          fuel_consumption_l_per_100km?: number
          id?: string
          is_active?: boolean
          max_distance_km?: number | null
          name?: string
          sort_order?: number
          vehicle_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      wood_species: {
        Row: {
          calorific_kwh_per_m3: number | null
          code: string
          company_id: string
          description: string | null
          hardness_group: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          warning: string | null
        }
        Insert: {
          calorific_kwh_per_m3?: number | null
          code: string
          company_id: string
          description?: string | null
          hardness_group?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          warning?: string | null
        }
        Update: {
          calorific_kwh_per_m3?: number | null
          code?: string
          company_id?: string
          description?: string | null
          hardness_group?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          warning?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wood_species_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      zone_communes: {
        Row: {
          city: string
          company_id: string
          delivery_days: number[] | null
          distance_km: number | null
          id: string
          insee_code: string | null
          is_served: boolean
          notes: string | null
          postal_code: string
          zone_id: string | null
        }
        Insert: {
          city: string
          company_id: string
          delivery_days?: number[] | null
          distance_km?: number | null
          id?: string
          insee_code?: string | null
          is_served?: boolean
          notes?: string | null
          postal_code: string
          zone_id?: string | null
        }
        Update: {
          city?: string
          company_id?: string
          delivery_days?: number[] | null
          distance_km?: number | null
          id?: string
          insee_code?: string | null
          is_served?: boolean
          notes?: string | null
          postal_code?: string
          zone_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "zone_communes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "zone_communes_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_stock_movement: {
        Args: {
          p_actor?: string
          p_movement_type: string
          p_order_id?: string
          p_quantity: number
          p_reason?: string
          p_variant_id: string
        }
        Returns: number
      }
      book_slot: {
        Args: { p_order_id: string; p_slot_id: string }
        Returns: undefined
      }
      current_customer_id: { Args: { cid: string }; Returns: string }
      generate_delivery_slots: {
        Args: { p_company_id: string; p_horizon_days?: number }
        Returns: number
      }
      has_company_role: {
        Args: { cid: string; roles: string[] }
        Returns: boolean
      }
      is_company_owner: { Args: { cid: string }; Returns: boolean }
      is_company_staff: { Args: { cid: string }; Returns: boolean }
      next_document_number: {
        Args: { p_company_id: string; p_kind: string }
        Returns: string
      }
      rattacher_client_au_compte: {
        Args: { p_company_id: string; p_email: string; p_user_id: string }
        Returns: string
      }
      release_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      release_slot: { Args: { p_order_id: string }; Returns: undefined }
      reserve_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      ship_order_stock: { Args: { p_order_id: string }; Returns: undefined }
      upsert_customer: {
        Args: {
          p_company_id: string
          p_email: string
          p_first_name?: string
          p_last_name?: string
          p_phone?: string
        }
        Returns: string
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
