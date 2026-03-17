const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// @react-native-google-signin: ana index GoogleSigninButton üzerinden statics.js hatası veriyor.
// Sadece GoogleSignin API'sini yükle (buton yok).
const googleSigninPackageRoot = path.resolve(
  __dirname,
  'node_modules/@react-native-google-signin/google-signin'
);
const googleSigninModulePath = path.join(
  googleSigninPackageRoot,
  'lib/module/signIn/GoogleSignin.js'
);

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@react-native-google-signin/google-signin') {
    return { filePath: googleSigninModulePath, type: 'sourceFile' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
