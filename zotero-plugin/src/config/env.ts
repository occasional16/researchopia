/**
 * Environment configuration for Researchopia
 * This file contains the Supabase configuration and other environment variables
 */

export const ENV_CONFIG = {
  // Supabase Configuration
  SUPABASE_URL: "https://obcblvdtqhwrihoddlez.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iY2JsdmR0cWh3cmlob2RkbGV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0OTgyMzUsImV4cCI6MjA3MzA3NDIzNX0.0kYlpFuK5WrKvUhIj7RO4-XJgv1sm39FROD_mBtxYm4",
  
  // API Configuration
  API_BASE_URL: "https://obcblvdtqhwrihoddlez.supabase.co/rest/v1",
  
  // Plugin Configuration
  PLUGIN_ID: "researchopia@zotero.plugin",
  PLUGIN_NAME: "Researchopia",
  PLUGIN_VERSION: "0.1.1",
  
  // Development flags
  DEBUG_MODE: true,
  ENABLE_LOGGING: true,
  
  // Feature flags
  ENABLE_PRECISE_TRACKING: true,
  ENABLE_SOCIAL_FEATURES: true,
  ENABLE_QUALITY_SCORING: true,
  
  // Cache settings
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes in milliseconds
  MAX_CACHE_SIZE: 1000,
  
  // UI settings
  MAX_ANNOTATIONS_PER_PAGE: 50,
  ANNOTATION_REFRESH_INTERVAL: 30000, // 30 seconds
  
  // Quality scoring thresholds
  MIN_QUALITY_SCORE: 60,
  HIGH_QUALITY_THRESHOLD: 80,
  
  // Social features limits
  MAX_COMMENTS_PER_ANNOTATION: 100,
  MAX_LIKES_PER_USER: 1000,
};

/**
 * Get environment configuration value
 */
export function getEnvConfig(key: keyof typeof ENV_CONFIG): any {
  return ENV_CONFIG[key];
}

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(feature: string): boolean {
  switch (feature) {
    case 'precise-tracking':
      return ENV_CONFIG.ENABLE_PRECISE_TRACKING;
    case 'social-features':
      return ENV_CONFIG.ENABLE_SOCIAL_FEATURES;
    case 'quality-scoring':
      return ENV_CONFIG.ENABLE_QUALITY_SCORING;
    default:
      return false;
  }
}

/**
 * Get Supabase configuration
 */
export function getSupabaseConfig() {
  return {
    url: ENV_CONFIG.SUPABASE_URL,
    anonKey: ENV_CONFIG.SUPABASE_ANON_KEY,
  };
}

/**
 * Log configuration (for debugging)
 */
export function logConfig() {
  if (ENV_CONFIG.DEBUG_MODE && ENV_CONFIG.ENABLE_LOGGING) {
    ztoolkit.log("Researchopia Configuration:", {
      pluginId: ENV_CONFIG.PLUGIN_ID,
      pluginName: ENV_CONFIG.PLUGIN_NAME,
      version: ENV_CONFIG.PLUGIN_VERSION,
      features: {
        preciseTracking: ENV_CONFIG.ENABLE_PRECISE_TRACKING,
        socialFeatures: ENV_CONFIG.ENABLE_SOCIAL_FEATURES,
        qualityScoring: ENV_CONFIG.ENABLE_QUALITY_SCORING,
      },
      supabaseUrl: ENV_CONFIG.SUPABASE_URL,
      debugMode: ENV_CONFIG.DEBUG_MODE,
    });
  }
}
