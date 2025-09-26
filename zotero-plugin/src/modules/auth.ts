import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { getPref, setPref, clearPref } from "../utils/prefs";
import { SUPABASE_CONFIG } from "../config/supabase";

export class AuthManager {
  private static supabase: SupabaseClient | null = null;

  static initialize() {
    // Initialize Supabase client
    try {
      this.supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
      ztoolkit.log("Supabase client initialized");

      // Check for existing session
      this.checkExistingSession();
    } catch (error) {
      ztoolkit.log("Failed to initialize Supabase client:", error);
      // Continue without Supabase - plugin should still work in offline mode
    }
  }

  static async checkExistingSession() {
    if (!this.supabase) return;

    try {
      const { data: { session } } = await this.supabase.auth.getSession();
      if (session) {
        addon.data.auth = {
          user: session.user,
          session: session,
          isLoggedIn: true,
        };
        ztoolkit.log("User session restored");
      }
    } catch (error) {
      ztoolkit.log("Error checking session:", error);
    }
  }

  static async signIn(email: string, password: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        ztoolkit.log("Sign in error:", error);
        return false;
      }

      if (data.user && data.session) {
        addon.data.auth = {
          user: data.user,
          session: data.session,
          isLoggedIn: true,
        };
        
        // Save login state
        setPref("userEmail", email);
        setPref("isLoggedIn", true);
        
        ztoolkit.log("User signed in successfully");
        return true;
      }
    } catch (error) {
      ztoolkit.log("Sign in error:", error);
    }

    return false;
  }

  static async signUp(email: string, password: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        ztoolkit.log("Sign up error:", error);
        return false;
      }

      ztoolkit.log("User signed up successfully");
      return true;
    } catch (error) {
      ztoolkit.log("Sign up error:", error);
    }

    return false;
  }

  static async signOut(): Promise<void> {
    if (!this.supabase) return;

    try {
      await this.supabase.auth.signOut();
      addon.data.auth = {
        user: null,
        session: null,
        isLoggedIn: false,
      };
      
      // Clear saved login state
      clearPref("userEmail");
      clearPref("isLoggedIn");
      
      ztoolkit.log("User signed out");
    } catch (error) {
      ztoolkit.log("Sign out error:", error);
    }
  }

  static isLoggedIn(): boolean {
    return addon.data.auth?.isLoggedIn || false;
  }

  static getCurrentUser() {
    return addon.data.auth?.user || null;
  }

  static getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }
}
