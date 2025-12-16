import { driver, DriveStep, Config } from 'driver.js';
import 'driver.js/dist/driver.css';

// Default Driver.js configuration
const defaultConfig: Config = {
  showProgress: true,
  allowClose: true,
  showButtons: ['next', 'previous', 'close'],
  popoverClass: 'drivedrop-tour-popover',
  progressText: 'Step {{current}} of {{total}}',
  nextBtnText: 'Next →',
  prevBtnText: '← Back',
  doneBtnText: '✓ Done',
  onDestroyed: () => {
    // Cleanup when tour is destroyed
  },
};

export const createTour = (steps: DriveStep[], config?: Partial<Config>) => {
  return driver({
    ...defaultConfig,
    ...config,
    steps,
  });
};

// Helper to create a step with common defaults
export const createStep = (
  element: string,
  title: string,
  description: string,
  options?: Partial<DriveStep>
): DriveStep => ({
  element,
  popover: {
    title,
    description,
    ...options?.popover,
  },
  ...options,
});
