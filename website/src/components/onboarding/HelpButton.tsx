'use client';

import { useState } from 'react';
import { HelpCircle, X, PlayCircle, BookOpen, Mail } from 'lucide-react';
import { createTour } from '@/lib/tour-config';
import { 
  clientDashboardTour, 
  driverDashboardTour, 
  adminDashboardTour,
  brokerDashboardTour,
  shipmentCreationTour 
} from '@/lib/tour-steps';
import { UserRole } from '@/types/onboarding';

interface HelpButtonProps {
  userRole: UserRole;
  currentPage?: 'dashboard' | 'shipment_creation' | 'tracking' | 'admin' | 'broker' | 'driver';
}

export function HelpButton({ userRole, currentPage = 'dashboard' }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleRestartTour = () => {
    let tour;
    
    switch (currentPage) {
      case 'dashboard':
        tour = userRole === 'client' ? clientDashboardTour :
               userRole === 'driver' ? driverDashboardTour :
               userRole === 'admin' ? adminDashboardTour :
               brokerDashboardTour;
        break;
      case 'shipment_creation':
        tour = shipmentCreationTour;
        break;
      default:
        return;
    }

    const driverInstance = createTour(tour.steps);
    driverInstance.drive();
    setIsOpen(false);
  };

  const getTourTitle = () => {
    switch (currentPage) {
      case 'dashboard':
        return 'Dashboard Tour';
      case 'shipment_creation':
        return 'Shipment Creation Tour';
      case 'tracking':
        return 'Tracking Tour';
      case 'admin':
        return 'Admin Panel Tour';
      case 'broker':
        return 'Broker Dashboard Tour';
      case 'driver':
        return 'Driver Dashboard Tour';
      default:
        return 'Product Tour';
    }
  };

  return (
    <>
      {/* Floating Help Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary-dark text-white rounded-full p-4 shadow-lg transition-all duration-200 hover:scale-110"
        aria-label="Help"
      >
        {isOpen ? <X className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
      </button>

      {/* Help Menu */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 bg-white rounded-lg shadow-xl border border-gray-200 w-72 overflow-hidden">
          <div className="bg-primary text-white px-4 py-3">
            <h3 className="font-semibold text-lg">Help & Support</h3>
            <p className="text-xs text-white/80 mt-1">Get assistance with DriveDrop</p>
          </div>

          <div className="p-2">
            {/* Restart Tour */}
            <button
              onClick={handleRestartTour}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              <PlayCircle className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Restart {getTourTitle()}</div>
                <div className="text-xs text-gray-500">Walk through the features again</div>
              </div>
            </button>

            {/* Documentation */}
            <a
              href="/help"
              target="_blank"
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              <BookOpen className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">View Documentation</div>
                <div className="text-xs text-gray-500">Detailed guides and FAQs</div>
              </div>
            </a>

            {/* Contact Support */}
            <a
              href="mailto:support@drivedrop.us.com"
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left"
            >
              <Mail className="w-5 h-5 text-primary" />
              <div>
                <div className="font-medium text-sm">Contact Support</div>
                <div className="text-xs text-gray-500">Get help from our team</div>
              </div>
            </a>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-100 px-4 py-2 bg-gray-50">
            <p className="text-xs text-gray-500 text-center">
              Need immediate help? Call <a href="tel:+17042662317" className="text-primary font-medium">+1-704-266-2317</a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
