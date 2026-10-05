import type { Session } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ session: null, loading: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export const useSession = () => useContext(AuthContext);

export function displayNameOf(session: Session | null) {
  const meta = session?.user.user_metadata ?? {};
  return (meta.full_name ?? meta.name ?? session?.user.email?.split('@')[0] ?? 'Guest') as string;
}

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    // Full-page redirect; supabase-js exchanges the returned code on load (detectSessionInUrl).
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) throw error;
    return;
  }

  const redirectTo = Linking.createURL('auth/callback');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return; // user dismissed the browser

  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  if (!code) throw new Error(url.searchParams.get('error_description') ?? 'Google sign-in failed');

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) throw exchangeError;
}

export const signOut = () => supabase.auth.signOut();
