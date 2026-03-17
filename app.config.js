const appJson = require('./app.json');
const { withBuildProperties } = require('expo-build-properties');

// Ensure dev client scheme is resolvable (helps avoid "Unable to determine default URI scheme" when plugin resolution is flaky)
let devClientScheme = appJson.expo?.extra?.devClientScheme;
if (!devClientScheme) {
  try {
    const getDefaultScheme = require('expo-dev-client/getDefaultScheme');
    devClientScheme = getDefaultScheme({ slug: appJson.expo?.slug || 'valoria-hotel' });
  } catch (_) {
    devClientScheme = 'exp+valoria-hotel';
  }
}
const extra = { ...appJson.expo?.extra, devClientScheme };

const expoWithBuild = withBuildProperties(
  { ...appJson.expo, extra },
  {
    android: {
      kotlinVersion: '2.0.21',
    },
  }
);

module.exports = { expo: expoWithBuild };
