import { Box, Typography } from '@mui/material';
import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { OAUTH_CHANNEL, type OAuthCallbackMessage } from '@/services/http/oauthChannel';

/**
 * Redirect target of the OAuth 2.0 authorization code flow. It only relays the query string to
 * the tab that started the sign-in (same origin, matched there by `state`) and closes itself.
 */
export default function OAuthCallbackPage() {
  const { search, pathname } = useLocation();
  const navigate = useNavigate();
  const relayed = useRef(false);
  useEffect(() => {
    if (relayed.current || !search) return undefined;
    relayed.current = true;
    const channel = new BroadcastChannel(OAUTH_CHANNEL);
    const message: OAuthCallbackMessage = { type: 'oauth-callback', search };
    channel.postMessage(message);
    channel.close();
    // Remove the code from the address bar and history.
    void navigate(pathname, { replace: true });
    const timer = setTimeout(() => {
      window.close();
    }, 300);
    return () => {
      clearTimeout(timer);
    };
  }, [search, pathname, navigate]);
  return (
    <Box sx={{ p: 4, bgcolor: 'background.default', minHeight: '100dvh' }}>
      <Typography variant="h5" component="h1">
        Sign-in finished
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1 }}>
        You can close this window and return to DevStudio.
      </Typography>
    </Box>
  );
}
