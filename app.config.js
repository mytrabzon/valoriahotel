const appJson = require('./app.json');
const { withBuildProperties } = require('expo-build-properties');

const expoWithBuild = withBuildProperties(appJson.expo, {
  android: {
    kotlinVersion: '2.0.21',
  },
});

module.exports = { expo: expoWithBuild };
