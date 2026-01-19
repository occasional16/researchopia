/**
 * Services Module Exports
 * Re-exports all service classes for convenient importing
 */

export { APIClient, getAPIClient, initAPIClient } from './api-client';
export { AuthService, getAuthService, initAuthService } from './auth-service';

export type { APIClientConfig, RequestOptions, APIResponse } from './api-client';
export type { AuthState, AuthCheckResult } from './auth-service';
