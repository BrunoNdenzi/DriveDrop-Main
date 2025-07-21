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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileCreationInProgress, setProfileCreationInProgress] = useState<Set<string>>(new Set());

  // Function to fetch user profile or create one if it doesn't exist
  const fetchUserProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // Check if profile creation is already in progress for this user
      if (profileCreationInProgress.has(userId)) {
        console.log('Profile creation already in progress for user:', userId);
        // Wait a bit and try to fetch again
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await fetchUserProfile(userId);
      }

      // First try to fetch existing profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code === 'PGRST116') {
        // Profile doesn't exist, create one
        console.log('Profile not found, creating new profile for user:', userId);
        
        // Mark profile creation as in progress
        setProfileCreationInProgress(prev => new Set(prev).add(userId));
        
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
              console.log('Profile already exists, fetching existing profile');
              const { data: existingData, error: fetchError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
              
              if (fetchError) {
                console.error('Error fetching existing profile:', fetchError);
                return null;
              }
              
              return existingData as UserProfile;
            }
            
            console.error('Error creating user profile:', insertError);
            return null;
          }

          console.log('Profile created successfully');
          return insertedData as UserProfile;
        } finally {
          // Remove from in-progress set
          setProfileCreationInProgress(prev => {
            const newSet = new Set(prev);
            newSet.delete(userId);
            return newSet;
          });
        }
      } else if (error) {
        console.error('Error fetching user profile:', error);
        return null;
      }

      return data as UserProfile;
    } catch (e) {
      console.error('Error in fetchUserProfile:', e);
      // Make sure to clean up in-progress state
      setProfileCreationInProgress(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
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
    <AuthContext.Provider value={{ user, userProfile, session, loading, error, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
