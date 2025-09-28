import { createClient, SupabaseClient, User, Session } from "@supabase/supabase-js";
import { getPref, setPref, clearPref } from "../utils/prefs";
import { getSupabaseConfig, getEnvConfig } from "../config/env";

// Enable strict mode for Zotero 8 compatibility
"use strict";

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoggedIn: boolean;
  lastSyncTime?: Date;
}

export class AuthManager {
  private static supabase: SupabaseClient | null = null;
  private static authState: AuthState = {
    user: null,
    session: null,
    isLoggedIn: false,
  };
  private static initialized: boolean = false;

  static async initialize() {
    if (this.initialized) return;
    
    try {
      ztoolkit.log("AuthManager initializing...");
      
      // Initialize Supabase client
      const config = getSupabaseConfig();
      if (config.url && config.anonKey) {
        this.supabase = createClient(config.url, config.anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
          },
        });
        
        ztoolkit.log("Supabase client initialized");
        
        // Check for existing session
        await this.checkExistingSession();
        
        // Set up auth state change listener  
        this.supabase.auth.onAuthStateChange((event, session) => {
          ztoolkit.log(`Auth state changed: ${event}`, session?.user?.email);
          this.updateAuthState(session?.user || null, session);
        });
        
      } else {
        ztoolkit.log("Supabase configuration not found - running in offline mode");
      }
      
      this.initialized = true;
      ztoolkit.log("AuthManager initialized successfully");
      
    } catch (error) {
      ztoolkit.log("Failed to initialize AuthManager:", error);
      // Continue without Supabase - plugin should still work in offline mode
    }
  }

  static cleanup() {
    this.initialized = false;
    this.supabase = null;
    this.authState = {
      user: null,
      session: null,
      isLoggedIn: false,
    };
    ztoolkit.log("AuthManager cleanup completed");
  }

  private static updateAuthState(user: User | null, session: Session | null) {
    this.authState = {
      user,
      session,
      isLoggedIn: !!user && !!session,
      lastSyncTime: new Date(),
    };
    
    // Update addon data
    if (addon?.data?.auth) {
      addon.data.auth = {
        user,
        session,
        isLoggedIn: this.authState.isLoggedIn,
      };
    }
    
    // Save to preferences for persistence
    if (user && session) {
      setPref("userEmail", user.email || "");
      setPref("userId", user.id);
      setPref("isLoggedIn", true);
      setPref("lastLoginTime", new Date().toISOString());
    } else {
      clearPref("userEmail");
      clearPref("userId");
      clearPref("isLoggedIn");
      clearPref("lastLoginTime");
    }
  }

  static async checkExistingSession() {
    if (!this.supabase) return;

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        ztoolkit.log("Error checking session:", error);
        return;
      }
      
      if (session?.user) {
        this.updateAuthState(session.user, session);
        ztoolkit.log("User session restored:", session.user.email);
      } else {
        ztoolkit.log("No existing session found");
      }
      
    } catch (error) {
      ztoolkit.log("Error checking existing session:", error);
    }
  }

  static async signIn(email: string, password: string): Promise<boolean> {
    if (!this.supabase) {
      ztoolkit.log("Supabase client not available");
      return false;
    }

    try {
      ztoolkit.log(`Attempting to sign in user: ${email}`);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        ztoolkit.log("Sign in error:", error.message);
        return false;
      }

      if (data.user && data.session) {
        this.updateAuthState(data.user, data.session);
        ztoolkit.log("User signed in successfully:", data.user.email);
        return true;
      } else {
        ztoolkit.log("Sign in succeeded but no user/session returned");
        return false;
      }
      
    } catch (error) {
      ztoolkit.log("Sign in error:", error);
      return false;
    }
  }

  static async signUp(email: string, password: string, metadata?: any): Promise<boolean> {
    if (!this.supabase) {
      ztoolkit.log("Supabase client not available");
      return false;
    }

    try {
      ztoolkit.log(`Attempting to sign up user: ${email}`);
      
      const { data, error } = await this.supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        ztoolkit.log("Sign up error:", error.message);
        return false;
      }

      // Note: For most Supabase setups, user needs to confirm email
      if (data.user) {
        ztoolkit.log("User signed up successfully. Check email for confirmation.");
        return true;
      }
      
      return false;
      
    } catch (error) {
      ztoolkit.log("Sign up error:", error);
      return false;
    }
  }

  static async signOut(): Promise<void> {
    if (!this.supabase) return;

    try {
      ztoolkit.log("Signing out user...");
      
      const { error } = await this.supabase.auth.signOut();
      
      if (error) {
        ztoolkit.log("Sign out error:", error.message);
      }
      
      // Clear auth state regardless of error
      this.updateAuthState(null, null);
      ztoolkit.log("User signed out");
      
    } catch (error) {
      ztoolkit.log("Sign out error:", error);
    }
  }

  static async resetPassword(email: string): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase.auth.resetPasswordForEmail(email);
      
      if (error) {
        ztoolkit.log("Password reset error:", error.message);
        return false;
      }
      
      ztoolkit.log("Password reset email sent to:", email);
      return true;
      
    } catch (error) {
      ztoolkit.log("Password reset error:", error);
      return false;
    }
  }

  static async refreshSession(): Promise<boolean> {
    if (!this.supabase) return false;

    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      
      if (error) {
        ztoolkit.log("Session refresh error:", error.message);
        return false;
      }
      
      if (data.session) {
        this.updateAuthState(data.user, data.session);
        return true;
      }
      
      return false;
      
    } catch (error) {
      ztoolkit.log("Session refresh error:", error);
      return false;
    }
  }

  static isLoggedIn(): boolean {
    return this.authState.isLoggedIn;
  }

  static getCurrentUser(): User | null {
    return this.authState.user;
  }

  static getCurrentSession(): Session | null {
    return this.authState.session;
  }

  static getAuthState(): AuthState {
    return { ...this.authState };
  }

  static getSupabaseClient(): SupabaseClient | null {
    return this.supabase;
  }

  /**
   * Check if current session is still valid
   */
  static async isSessionValid(): Promise<boolean> {
    if (!this.supabase || !this.authState.session) return false;

    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      return !error && !!session;
    } catch {
      return false;
    }
  }

  /**
   * Get user's display name for UI
   */
  static getUserDisplayName(): string {
    const user = this.getCurrentUser();
    if (!user) return "Anonymous";
    
    return user.user_metadata?.display_name || 
           user.user_metadata?.full_name || 
           user.email?.split('@')[0] || 
           "User";
  }

  /**
   * Check if user has specific permissions
   */
  static async checkPermissions(permission: string): Promise<boolean> {
    const user = this.getCurrentUser();
    if (!user) return false;

    // Implement permission checking logic based on your needs
    // This could check user roles, subscription status, etc.
    
    return true; // For now, all authenticated users have all permissions
  }
}
