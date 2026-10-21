import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, BackHandler, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'
import * as Location from 'expo-location'
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition'
import { startTracking, stopTracking, type TripConfig } from './src/tracking'
import { ensureTrackingPermission } from './src/permissions'

const PLANNER_URL = process.env.EXPO_PUBLIC_PLANNER_URL ?? 'https://drivedrop.us.com/route-planner'
// React Native's built-in URL cannot read a host name, so pull it out by hand.
function parseUrl(url: string): { protocol: string; host: string } | null {
  const match = /^([a-z][a-z0-9+.-]*:)(?:\/\/([^/:?#]*))?/i.exec(url)
  return match ? { protocol: match[1]!.toLowerCase(), host: (match[2] ?? '').toLowerCase() } : null
}

const PLANNER_HOST = parseUrl(PLANNER_URL)?.host ?? 'drivedrop.us.com'
const KEEP_AWAKE_TAG = 'trip'

// Tells the page it is running inside the app, and that the app can listen for Benji.
const BEFORE_LOAD = `window.__DRIVEDROP_NATIVE__ = { platform: 'android', speech: true }; true;`

type PageMessage =
  | { type: 'trip-start'; executionId: string; trackingToken: string; expiresAt: string; apiBase: string }
  | { type: 'trip-stop' }
  | { type: 'stt-start'; hints: string[] }
  | { type: 'stt-stop' }

function parseMessage(raw: string): PageMessage | null {
  try {
    const message = JSON.parse(raw) as Record<string, unknown>
    if (message.type === 'trip-stop' || message.type === 'stt-stop') return { type: message.type }
    if (message.type === 'stt-start') {
      const hints = Array.isArray(message.hints) ? message.hints.filter((hint): hint is string => typeof hint === 'string' && hint.length <= 60).slice(0, 60) : []
      return { type: 'stt-start', hints }
    }
    if (
      message.type === 'trip-start'
      && typeof message.executionId === 'string'
      && typeof message.trackingToken === 'string'
      && typeof message.expiresAt === 'string'
      && typeof message.apiBase === 'string'
      && /^https:\/\//.test(message.apiBase)
    ) {
      return { type: 'trip-start', executionId: message.executionId, trackingToken: message.trackingToken, expiresAt: message.expiresAt, apiBase: message.apiBase }
    }
  } catch {
    // Not for us.
  }
  return null
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Planner />
    </SafeAreaProvider>
  )
}

function Planner() {
  // Android 16 draws apps behind the status and navigation bars, so the page is kept clear of them.
  const insets = useSafeAreaInsets()
  const edges = { paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }
  const web = useRef<WebView>(null)
  const canGoBack = useRef(false)
  const heard = useRef(false)
  const [failed, setFailed] = useState(false)

  const tell = (detail: Record<string, unknown>) => {
    web.current?.injectJavaScript(`window.dispatchEvent(new CustomEvent('drivedrop-native', { detail: ${JSON.stringify(detail)} })); true;`)
  }

  useSpeechRecognitionEvent('result', event => {
    const text = event.results[0]?.transcript?.trim()
    if (!text) return
    heard.current = true
    tell({ type: event.isFinal ? 'stt-final' : 'stt-interim', text })
  })
  useSpeechRecognitionEvent('error', event => {
    tell({ type: 'stt-end', reason: event.error === 'not-allowed' || event.error === 'service-not-allowed' ? 'denied' : event.error === 'no-speech' ? 'silence' : 'error' })
    heard.current = false
  })
  useSpeechRecognitionEvent('end', () => {
    // An error already reported its own ending; a clean end is reported here.
    if (heard.current) tell({ type: 'stt-end', reason: 'done' })
    else tell({ type: 'stt-end', reason: 'silence' })
    heard.current = false
  })

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack.current) return false
      web.current?.goBack()
      return true
    })
    return () => subscription.remove()
  }, [])

  const startTrip = async (trip: TripConfig) => {
    if (!(await ensureTrackingPermission())) return
    try {
      await startTracking(trip)
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG)
    } catch {
      // The page keeps tracking while it is open, so a service that will not start is not fatal.
    }
  }

  const stopTrip = async () => {
    await stopTracking()
    deactivateKeepAwake(KEEP_AWAKE_TAG)
  }

  const startListening = async (hints: string[]) => {
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!permission.granted) {
      tell({ type: 'stt-end', reason: 'denied' })
      return
    }
    heard.current = false
    ExpoSpeechRecognitionModule.start({
      lang: 'en-US',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      addsPunctuation: true,
      // Names and streets from today's route are recognised first.
      contextualStrings: hints,
      // A driver pauses to think or to watch the road, so wait longer than the default before deciding they have finished.
      androidIntentOptions: {
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1800,
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 2500,
      },
    })
  }

  const onMessage = (event: WebViewMessageEvent) => {
    const message = parseMessage(event.nativeEvent.data)
    if (!message) return
    if (message.type === 'trip-start') void startTrip(message)
    else if (message.type === 'trip-stop') void stopTrip()
    else if (message.type === 'stt-start') void startListening(message.hints)
    else ExpoSpeechRecognitionModule.abort()
  }

  // The planner stays inside the app; phone numbers, mail and other sites open in their own apps.
  const allowNavigation = (url: string): boolean => {
    const target = parseUrl(url)
    if (target) {
      if (target.protocol === 'https:' && (target.host === PLANNER_HOST || target.host.endsWith(`.${PLANNER_HOST}`))) return true
      if (target.protocol === 'about:' || target.protocol === 'blob:' || target.protocol === 'data:') return true
    }
    void Linking.openURL(url).catch(() => undefined)
    return false
  }

  if (failed) {
    return (
      <View style={[styles.center, edges]}>
        <StatusBar style="light" />
        <Text style={styles.title}>Can&apos;t reach the planner</Text>
        <Text style={styles.body}>Check your signal, then try again.</Text>
        <Pressable style={styles.button} onPress={() => { setFailed(false); web.current?.reload() }}>
          <Text style={styles.buttonText}>Try again</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View style={[styles.root, edges]}>
      <StatusBar style="light" backgroundColor="#123638" />
      <WebView
        ref={web}
        source={{ uri: PLANNER_URL }}
        style={styles.web}
        applicationNameForUserAgent="DriveDropRoutePlanner/1.0"
        injectedJavaScriptBeforeContentLoaded={BEFORE_LOAD}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={request => allowNavigation(request.url)}
        onNavigationStateChange={state => { canGoBack.current = state.canGoBack }}
        onError={() => setFailed(true)}
        onHttpError={event => { if (event.nativeEvent.statusCode >= 500) setFailed(true) }}
        onLoadEnd={() => { void Location.requestForegroundPermissionsAsync() }}
        startInLoadingState
        renderLoading={() => <View style={styles.center}><ActivityIndicator color="#ffffff" /></View>}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mixedContentMode="never"
        allowFileAccess={false}
        setSupportMultipleWindows={false}
        textZoom={100}
        overScrollMode="never"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101d1e' },
  web: { flex: 1, backgroundColor: '#101d1e' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#101d1e', padding: 24 },
  title: { color: '#ffffff', fontSize: 20, fontWeight: '700' },
  body: { color: '#c6dbd8', marginTop: 8, fontSize: 15, textAlign: 'center' },
  button: { marginTop: 20, backgroundColor: '#ffffff', paddingHorizontal: 24, height: 48, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#123638', fontSize: 16, fontWeight: '700' },
})
