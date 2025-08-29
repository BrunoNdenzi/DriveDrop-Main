import React, { createContext, useState, useEffect, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { auth, supabase } from '../lib/supabase';

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'client' | 'driver' | 'admin';
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  rating?: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  session: null,
  loading: true,
  error: null,
  refreshProfile: async () => {},
});

// In-memory cache for profile creation status, shared across all instances
const profileCreationStatus = new Map<string, Promise<UserProfile | null>>();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch or create user profile - uses a mutex pattern to prevent race conditions
  const fetchUserProfile = async (
    userId: string
  ): Promise<UserProfile | null> => {
    try {
      // Check if there's already an ongoing fetch/creation operation for this user
      if (profileCreationStatus.has(userId)) {
        console.log(
          'Profile fetch/creation already in progress for user:',
          userId
        );
        // Wait for the existing operation to complete
        return await profileCreationStatus.get(userId)!;
      }

      // Create a new promise for this operation
      const profilePromise = (async () => {
        try {
          // First try to fetch existing profile
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (error && error.code === 'PGRST116') {
            // Profile doesn't exist, create one
            console.log(
              'Profile not found, creating new profile for user:',
              userId
            );

            try {
              // Get user metadata from auth
              const { data: authData } = await auth.getUser();
              const userMetadata = authData.user?.user_metadata || {};

              // Create new profile
              const newProfile = {
                id: userId,
                first_name: userMetadata.first_name || 'User',
                last_name: userMetadata.last_name || '',
                email: authData.user?.email || '',
                role: userMetadata.role || 'client',
                phone: userMetadata.phone || null,
                avatar_url: null,
                is_verified: false,
                rating: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };

              const { data: insertedData, error: insertError } = await supabase
                .from('profiles')
                .insert([newProfile])
                .select()
                .single();

              if (insertError) {
                // If it's a duplicate key error, try to fetch the existing profile
                if (insertError.code === '23505') {
                  console.log(
                    'Profile already exists (race condition), fetching existing profile'
                  );
                  const { data: existingData, error: fetchError } =
                    await supabase
                      .from('profiles')
                      .select('*')
                      .eq('id', userId)
                      .single();

                  if (fetchError) {
                    console.error(
                      'Error fetching existing profile:',
                      fetchError
                    );
                    return null;
                  }

                  return existingData as UserProfile;
                }

                console.error('Error creating user profile:', insertError);
                return null;
              }

              console.log('Profile created successfully');
              return insertedData as UserProfile;
            } catch (e) {
              console.error('Error in profile creation:', e);
              return null;
            }
          } else if (error) {
            console.error('Error fetching user profile:', error);
            return null;
          }

          return data as UserProfile;
        } catch (e) {
          console.error('Error in fetchUserProfile:', e);
          return null;
        }
      })();

      // Store the promise in our map
      profileCreationStatus.set(userId, profilePromise);

      // Wait for completion
      const result = await profilePromise;

      // Clean up after completion
      profileCreationStatus.delete(userId);

      return result;
    } catch (e) {
      console.error('Unexpected error in profile fetch/creation:', e);
      profileCreationStatus.delete(userId);
      return null;
    }
  };

  // Function to refresh profile (useful after updates)
  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id);
      setUserProfile(profile);
    }
  };

  // Get the user's session on load
  useEffect(() => {
    let mounted = true;

    async function loadUserSession() {
      try {
        setLoading(true);

        // Get the user's current session
        const { data, error } = await auth.getSession();

        if (error) {
          throw error;
        }

        if (data?.session && mounted) {
          setSession(data.session);
          setUser(data.session.user);

          // Fetch user profile
          const profile = await fetchUserProfile(data.session.user.id);
          if (mounted) {
            setUserProfile(profile);
          }
        }
      } catch (e: any) {
        if (mounted) {
          setError(e.message);
          console.error('Error loading user session:', e);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadUserSession();

    // Subscribe to auth changes
    const { data } = auth.onAuthStateChange(async (event, newSession) => {
      console.log(`Auth event: ${event}`);

      if (!mounted) return;

      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);

        // Fetch user profile
        const profile = await fetchUserProfile(newSession.user.id);
        if (mounted) {
          setUserProfile(profile);
        }
      } else {
        setSession(null);
        setUser(null);
        setUserProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    });

    // Cleanup function
    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, userProfile, session, loading, error, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
