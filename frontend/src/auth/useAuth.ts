import { useCallback } from 'react';
import {
  useMsal,
  useIsAuthenticated,
  useAccount,
} from '@azure/msal-react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { loginRequest } from './msalConfig';

export function useAuth() {
  const { instance, accounts } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const account = useAccount(accounts[0] || null);

  const login = useCallback(async () => {
    try {
      await instance.loginPopup(loginRequest);
    } catch (error) {
      console.error('Login failed:', error);
    }
  }, [instance]);

  const logout = useCallback(async () => {
    await instance.logoutPopup({
      postLogoutRedirectUri: window.location.origin,
    });
  }, [instance]);

  const getAccessToken = useCallback(
    async (scopes: string[]) => {
      if (!account) throw new Error('No active account');

      try {
        const response = await instance.acquireTokenSilent({
          scopes,
          account,
        });
        return response.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          const response = await instance.acquireTokenPopup({ scopes });
          return response.accessToken;
        }
        throw error;
      }
    },
    [instance, account],
  );

  return {
    isAuthenticated,
    account,
    user: account
      ? {
          name: account.name || '',
          username: account.username || '',
          oid: account.localAccountId || '',
        }
      : null,
    login,
    logout,
    getAccessToken,
  };
}
