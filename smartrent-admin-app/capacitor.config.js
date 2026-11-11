module.exports = {
  appId: 'com.smartrent.admin',
  appName: 'SmartRent Admin',
  webDir: 'www',
  bundledWeb: true,
  plugins: {
    SplashScreen: {
      launchShowDuration: 3000,
      backgroundColor: '#4f46e5',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerColor: '#ffffff',
    },
    StatusBar: {
      backgroundColor: '#4f46e5',
      style: 'DARK',
    },
  },
};
