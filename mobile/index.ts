// CRITICAL: Import FormData polyfill FIRST before ANYTHING else
import './formDataPolyfill';

// Polyfill FormData for React Native
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';
import App from './App';

console.log('[Index] Registering root component...');

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
registerRootComponent(App);
