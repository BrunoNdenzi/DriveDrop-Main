const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Custom Expo config plugin to add Google Maps API key to AndroidManifest.xml
 * This is needed because react-native-maps doesn't have a built-in config plugin
 */
const withGoogleMaps = (config, { apiKey }) => {
  return withAndroidManifest(config, (config) => {
    const androidManifest = config.modResults;
    const application = androidManifest.manifest.application[0];

    // Check if the Google Maps API key meta-data already exists
    const existingMetaData = application['meta-data'] || [];
    const googleMapsMetaDataIndex = existingMetaData.findIndex(
      (item) => item.$['android:name'] === 'com.google.android.geo.API_KEY'
    );

    // Remove existing if found
    if (googleMapsMetaDataIndex !== -1) {
      existingMetaData.splice(googleMapsMetaDataIndex, 1);
    }

    // Add Google Maps API key meta-data
    if (apiKey) {
      existingMetaData.push({
        $: {
          'android:name': 'com.google.android.geo.API_KEY',
          'android:value': apiKey,
        },
      });
    }

    application['meta-data'] = existingMetaData;

    return config;
  });
};

module.exports = withGoogleMaps;
