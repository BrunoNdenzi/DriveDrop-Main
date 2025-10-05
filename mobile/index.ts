/**
 * Main Entry Point
 * NOTE: Native module protection is now injected via metro.config.js
 * See: nativeModuleProtection.js
 */

import { registerRootComponent } from 'expo';
import App from './App';

console.log('[Index] Registering root component...');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
