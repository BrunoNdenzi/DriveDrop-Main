'use client';

import { useEffect, useState } from 'react';
import { createTour } from '@/lib/tour-config';
import { TourConfig } from '@/types/onboarding';
import { useAuth } from '@/hooks/useAuth';

interface OnboardingTourProps {
  tourConfig: TourConfig;
  autoStart?: boolean;
  storageKey: string;
}

export function OnboardingTour({ 
  tourConfig, 
  autoStart = true,
  storageKey 
}: OnboardingTourProps) {
  const [hasShown, setHasShown] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user || hasShown || !autoStart) return;

    // Check if tour has been completed
    const checkTourStatus = async () => {
      try {
        const response = await fetch('/api/onboarding');
        const data = await response.json();
        
        const tourKey = `${storageKey}_completed` as keyof typeof data;
        const isCompleted = data[tourKey];

        // Also check if user has disabled tours
        if (isCompleted || !data.show_tours) {
          setHasShown(true);
          return;
        }

        // Small delay to ensure DOM is ready
        setTimeout(() => {
          const driverInstance = createTour(tourConfig.steps, {
            onDestroyed: async () => {
              // Mark tour as completed
              await fetch('/api/onboarding', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [tourKey]: true }),
              });
              
              if (tourConfig.onComplete) {
                tourConfig.onComplete();
              }
            },
          });

          driverInstance.drive();
          setHasShown(true);
        }, 500);
      } catch (error) {
        console.error('Error checking tour status:', error);
      }
    };

    checkTourStatus();
  }, [user, hasShown, autoStart, storageKey, tourConfig]);

  return null;
}
