// The background task has to be registered before the app renders, so the phone can run it even when the app was closed.
import './src/tracking'
import { registerRootComponent } from 'expo'
import App from './App'

registerRootComponent(App)
