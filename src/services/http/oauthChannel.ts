/** Shared by the OAuth client and the tiny /oauth/callback page (kept out of the client bundle). */
export const OAUTH_CHANNEL = 'devstudio-oauth';
export const OAUTH_CALLBACK_PATH = '/oauth/callback';

export interface OAuthCallbackMessage {
  type: 'oauth-callback';
  search: string;
}
