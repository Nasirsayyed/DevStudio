import { AppError, ValidationError } from '@/core/errors/AppError';
import {
  authorizationUrl,
  createPkce,
  createState,
  type OAuthConfig,
  parseCallback,
  parseTokenResponse,
  tokenRequest,
  type TokenResponse,
  validateOAuthConfig,
} from '@/core/http/oauth';
import { abortError } from '@/services/workers/taskRunner';
import { sendRequest } from './executor';
import { OAUTH_CALLBACK_PATH, OAUTH_CHANNEL, type OAuthCallbackMessage } from './oauthChannel';

const LOGIN_TIMEOUT_MS = 5 * 60_000;

export function oauthRedirectUri(origin = window.location.origin): string {
  return `${origin}${OAUTH_CALLBACK_PATH}`;
}

async function exchange(
  config: OAuthConfig,
  grant: Parameters<typeof tokenRequest>[1],
  signal?: AbortSignal,
): Promise<TokenResponse> {
  const req = tokenRequest(config, grant);
  // Same executor as the Request Builder: CORS failures are explained, never bypassed.
  const response = await sendRequest(
    {
      method: 'POST',
      url: req.url,
      headers: req.headers,
      body: { kind: 'text', text: req.body },
      missing: [],
      warnings: [],
    },
    { signal, timeoutMs: 30_000, followRedirects: true, includeCredentials: false },
  );
  return parseTokenResponse(response.status, response.text ?? '');
}

/** Client credentials grant: one request to the token endpoint. */
export function clientCredentialsToken(
  config: OAuthConfig,
  signal?: AbortSignal,
): Promise<TokenResponse> {
  validateOAuthConfig(config);
  return exchange(config, { type: 'client_credentials' }, signal);
}

/**
 * Authorization code grant with PKCE: opens the provider's login page in a popup, waits for the
 * redirect to /oauth/callback (relayed over a same-origin BroadcastChannel and matched by `state`)
 * and exchanges the code. The verifier never leaves this tab's memory.
 */
export async function authorizationCodeToken(
  config: OAuthConfig,
  signal?: AbortSignal,
  openWindow: (url: string) => Window | null = (url) =>
    window.open(url, 'devstudio-oauth', 'popup,width=520,height=720'),
): Promise<TokenResponse> {
  validateOAuthConfig(config);
  const { verifier, challenge } = await createPkce();
  const state = createState();
  const redirectUri = oauthRedirectUri();
  const channel = new BroadcastChannel(OAUTH_CHANNEL);
  try {
    const code = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new AppError('TIMEOUT', 'The sign-in was not completed within 5 minutes.'));
      }, LOGIN_TIMEOUT_MS);
      const stop = (fn: () => void) => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        fn();
      };
      const onAbort = () => {
        stop(() => {
          reject(abortError());
        });
      };
      signal?.addEventListener('abort', onAbort);
      channel.onmessage = (event: MessageEvent<OAuthCallbackMessage>) => {
        const data = event.data as Partial<OAuthCallbackMessage> | null;
        if (data?.type !== 'oauth-callback' || typeof data.search !== 'string') return;
        const result = parseCallback(data.search);
        if (result.state !== state) return; // Another sign-in, or a forged redirect.
        if (result.error)
          stop(() => {
            reject(new ValidationError(`The provider returned an error (${result.error ?? ''}).`));
          });
        else if (!result.code)
          stop(() => {
            reject(new ValidationError('The provider redirected back without a code.'));
          });
        else {
          const value = result.code;
          stop(() => {
            resolve(value);
          });
        }
      };
      if (!openWindow(authorizationUrl(config, redirectUri, state, challenge)))
        stop(() => {
          reject(
            new ValidationError(
              'The sign-in window was blocked. Allow pop-ups for this site and try again.',
            ),
          );
        });
    });
    return await exchange(
      config,
      { type: 'authorization_code', code, verifier, redirectUri },
      signal,
    );
  } finally {
    channel.close();
  }
}
