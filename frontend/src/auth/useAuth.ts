import { useCallback, useMemo } from "react";
import { useMsal, useIsAuthenticated, useAccount } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";
import { loginRequest } from "./msalConfig";
import { useLocalAuth } from "./useLocalAuth";

const DEV_MODE = import.meta.env.VITE_DEV_MODE === "true";
const DEV_USER_OID =
  import.meta.env.VITE_DEV_USER_OID ||
  "dev-user-00000000-0000-0000-0000-000000000001";
const DEV_USER_NAME = import.meta.env.VITE_DEV_USER_NAME || "Test Admin";

const devAuthValue = {
  isAuthenticated: true,
  account: null,
  user: {
    name: DEV_USER_NAME,
    username: "dev@localhost",
    oid: DEV_USER_OID,
  },
  isSuperAdmin: true,
  login: async () => {},
  logout: async () => {
    window.location.reload();
  },
  getAccessToken: async () => "dev-token",
};

export const useAuth = DEV_MODE
  ? () => devAuthValue
  : () => {
      const { instance, accounts } = useMsal();
      const isMsalAuthenticated = useIsAuthenticated();
      const account = useAccount(accounts[0] || null);
      const {
        isLocalAuthenticated,
        localUser,
        logoutLocal,
        getLocalToken,
      } = useLocalAuth();

      // ── Local auth takes priority over MSAL ──
      // Memoize everything to prevent infinite re-render loops in useEffect deps.
      const localGetToken = useCallback(
        async () => getLocalToken(),
        [getLocalToken],
      );
      const localLogout = useCallback(() => {
        logoutLocal();
        window.location.href = "/login";
      }, [logoutLocal]);
      const localUser_ = useMemo(
        () =>
          localUser
            ? {
                name: localUser.displayName,
                username: localUser.email,
                oid: localUser.id,
              }
            : null,
        [localUser],
      );

      if (isLocalAuthenticated && localUser) {
        return {
          isAuthenticated: true,
          account: null,
          user: localUser_,
          isSuperAdmin: localUser.isSuperAdmin,
          login: async () => {},
          logout: localLogout,
          getAccessToken: localGetToken,
        };
      }

      // ── MSAL auth ──
      const login = useCallback(async () => {
        try {
          await instance.loginPopup(loginRequest);
        } catch (error) {
          console.error("Login failed:", error);
        }
      }, [instance]);

      const logout = useCallback(async () => {
        await instance.logoutPopup({
          postLogoutRedirectUri: window.location.origin,
        });
      }, [instance]);

      const getAccessToken = useCallback(
        async (scopes: string[]) => {
          if (!account) throw new Error("No active account");

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
        isAuthenticated: isMsalAuthenticated,
        account,
        user: account
          ? {
              name: account.name || "",
              username: account.username || "",
              oid: account.localAccountId || "",
            }
          : null,
        isSuperAdmin: false, // MSAL super admin determined server-side
        login,
        logout,
        getAccessToken,
      };
    };
