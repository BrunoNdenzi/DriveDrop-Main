import { Alert } from 'react-native'
import * as Location from 'expo-location'
import { disclosureAccepted, rememberDisclosure } from './tracking'

const ask = (title: string, message: string, accept: string): Promise<boolean> =>
  new Promise(resolve => {
    Alert.alert(title, message, [
      { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
      { text: accept, onPress: () => resolve(true) },
    ], { cancelable: false })
  })

// Play requires an on-screen explanation before the phone's own location prompts.
export async function ensureTrackingPermission(): Promise<boolean> {
  if (!(await disclosureAccepted())) {
    const agreed = await ask(
      'Share your position during trips',
      'DriveDrop Route Planner collects your location while a trip is running, including when the app is closed or not in use, so your dispatcher and your customers\u2019 ETA links see where you are. It stops when the trip ends.',
      'Continue',
    )
    if (!agreed) return false
    await rememberDisclosure()
  }

  const foreground = await Location.requestForegroundPermissionsAsync()
  if (foreground.status !== 'granted') return false

  const background = await Location.getBackgroundPermissionsAsync()
  if (background.status !== 'granted') {
    const next = await Location.requestBackgroundPermissionsAsync()
    if (next.status !== 'granted') {
      Alert.alert('Keep sharing in the background', 'To keep sharing your position while you use other apps, open Settings, then Permissions, then Location, and choose Allow all the time.')
      return false
    }
  }
  return true
}
