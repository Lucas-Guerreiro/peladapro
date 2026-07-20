import { useState, useEffect, useCallback } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface Profile {
  id: string;
  nome: string;
  email: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AuthError {
  error: string | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[useAuth] Error fetching profile:', error.message);
        return null;
      }

      return data as Profile;
    } catch (err) {
      console.error('[useAuth] Unexpected error fetching profile:', err);
      return null;
    }
  }, []);

  const refreshProfile = useCallback(async (): Promise<void> => {
    if (!user) {
      setProfile(null);
      return;
    }
    const fetchedProfile = await fetchProfile(user.id);
    setProfile(fetchedProfile);
  }, [user, fetchProfile]);

  // On mount, fetch the current session and subscribe to auth state changes
  useEffect(() => {
    let mounted = true;

    const getInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[useAuth] Error getting session:', error.message);
        }
        if (mounted) {
          const currentSession = data.session;
          setSession(currentSession);
          setUser(currentSession?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[useAuth] Unexpected error getting session:', err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription.unsubscribe();
    };
  }, []);

  // When user changes, fetch the corresponding profile from 'profiles' table
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    let mounted = true;

    const loadProfile = async () => {
      const fetchedProfile = await fetchProfile(user.id);
      if (mounted) {
        setProfile(fetchedProfile);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [user, fetchProfile]);

  const signUp = useCallback(
    async (email: string, password: string, nome: string): Promise<AuthError> => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              nome,
            },
          },
        });

        if (error) {
          return { error: error.message };
        }

        const newUser = data.user;

        // After signUp, create a profile entry in the 'profiles' table
        if (newUser) {
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: newUser.id,
              nome,
              email: newUser.email ?? email,
            });

          if (profileError) {
            console.error('[useAuth] Error creating profile:', profileError.message);
            // Profile creation failure should not block the signup flow.
            // The auth account is already created; profile can be retried later.
          }
        }

        return { error: null };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during sign up';
        console.error('[useAuth] signUp error:', err);
        return { error: message };
      }
    },
    []
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthError> => {
      try {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          return { error: error.message };
        }

        return { error: null };
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'An unexpected error occurred during sign in';
        console.error('[useAuth] signIn error:', err);
        return { error: message };
      }
    },
    []
  );

  const signOut = useCallback(async (): Promise<AuthError> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message };
      }
      setProfile(null);
      return { error: null };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during sign out';
      console.error('[useAuth] signOut error:', err);
      return { error: message };
    }
  }, []);

  return {
    user,
    profile,
    session,
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };
}