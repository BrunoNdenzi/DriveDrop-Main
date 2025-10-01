module.exports = {
  dependencies: {
    '@stripe/stripe-react-native': {
      platforms: {
        android: null, // disable Android platform, other platforms will still autolink if provided
      },
    },
  },
};