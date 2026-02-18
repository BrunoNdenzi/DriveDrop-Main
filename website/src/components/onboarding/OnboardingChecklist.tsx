'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, X } from 'lucide-react';
import { OnboardingProgress } from '@/types/onboarding';

interface OnboardingChecklistProps {
  userRole: 'client' | 'driver' | 'admin' | 'broker';
}

const checklistItems = {
  client: [
    { key: 'profile_completed', label: 'Complete your profile', description: 'Add your contact info and preferences' },
    { key: 'payment_method_added', label: 'Add payment method', description: 'Add a card for faster checkout' },
    { key: 'first_shipment_created', label: 'Create your first shipment', description: 'Try sending something!' },
    { key: 'first_shipment_tracked', label: 'Track a shipment', description: 'See real-time location updates' },
  ],
  driver: [
    { key: 'profile_completed', label: 'Complete your profile', description: 'Add your photo and bio' },
    { key: 'documents_uploaded', label: 'Upload required documents', description: 'License, insurance, and registration' },
    { key: 'first_shipment_created', label: 'Accept your first job', description: 'Start earning with DriveDrop' },
  ],
  admin: [
    { key: 'profile_completed', label: 'Set up admin profile', description: 'Configure your admin settings' },
  ],
  broker: [
    { key: 'profile_completed', label: 'Complete broker profile', description: 'Add company and contact details' },
    { key: 'documents_uploaded', label: 'Upload broker documents', description: 'Authority, insurance, and licenses' },
  ],
};

export function OnboardingChecklist({ userRole }: OnboardingChecklistProps) {
  const [progress, setProgress] = useState<OnboardingProgress | null>(null);
  const [isVisible, setIsVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProgress();
  }, []);

  const fetchProgress = async () => {
    try {
      const response = await fetch('/api/onboarding');
      const data = await response.json();
      setProgress(data.checklist_progress);
      
      // Check if all items are completed
      const items = checklistItems[userRole];
      const allCompleted = items.every(item => 
        data.checklist_progress[item.key as keyof OnboardingProgress]
      );
      
      // Hide checklist if all completed
      if (allCompleted) {
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error fetching progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateProgress = async (key: string, value: boolean) => {
    try {
      await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistKey: key, value }),
      });
      
      setProgress(prev => prev ? { ...prev, [key]: value } : null);
    } catch (error) {
      console.error('Error updating progress:', error);
    }
  };

  const items = checklistItems[userRole];
  
  if (!isVisible || isLoading || !progress) {
    return null;
  }

  const completedCount = items.filter(item => 
    progress[item.key as keyof OnboardingProgress]
  ).length;
  const totalCount = items.length;
  const percentage = Math.round((completedCount / totalCount) * 100);

  return (
    <div className="bg-white rounded-md border border-gray-200 p-4 mb-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            Getting Started with DriveDrop
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Complete these steps to get the most out of your account
          </p>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Close checklist"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            {completedCount} of {totalCount} completed
          </span>
          <span className="text-sm font-semibold text-primary">
            {percentage}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div
            className="bg-primary h-2.5 rounded-full transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-3">
        {items.map((item) => {
          const isCompleted = progress[item.key as keyof OnboardingProgress];
          
          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-md transition-all ${
                isCompleted 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <button
                onClick={() => updateProgress(item.key, !isCompleted)}
                className="mt-0.5 flex-shrink-0"
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Circle className="w-5 h-5 text-gray-400" />
                )}
              </button>
              <div className="flex-1">
                <div className={`font-medium text-sm ${
                  isCompleted ? 'text-green-900 line-through' : 'text-gray-900'
                }`}>
                  {item.label}
                </div>
                <div className={`text-xs mt-0.5 ${
                  isCompleted ? 'text-green-700' : 'text-gray-500'
                }`}>
                  {item.description}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion Message */}
      {percentage === 100 && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm font-medium text-green-900 text-center">
            🎉 Congratulations! You've completed all onboarding steps!
          </p>
        </div>
      )}
    </div>
  );
}
