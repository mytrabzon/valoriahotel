import { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { WebView } from 'react-native-webview';

const DEFAULT_LAT = 40.6144;
const DEFAULT_LON = 40.31188;

type HotelMapProps = {
  latitude?: number;
  longitude?: number;
  title?: string;
  style?: object;
};

export default function HotelMap({
  latitude = DEFAULT_LAT,
  longitude = DEFAULT_LON,
  title = 'Valoria Hotel',
  style,
}: HotelMapProps) {
  const mapboxToken =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
      ? process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN
      : '';

  const region = {
    latitude,
    longitude,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const mapboxHtml = useMemo(() => {
    const token = mapboxToken.replace(/"/g, '');
    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <script src="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js"></script>
  <link href="https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css" rel="stylesheet"/>
  <style>body{margin:0;} #map{width:100%;height:100%;}</style>
</head>
<body>
  <div id="map"></div>
  <script>
    mapboxgl.accessToken = '${token}';
    var map = new mapboxgl.Map({ container: 'map', style: 'mapbox://styles/mapbox/streets-v12', center: [${longitude}, ${latitude}], zoom: 15 });
    new mapboxgl.Marker().setLngLat([${longitude}, ${latitude}]).setPopup(new mapboxgl.Popup().setHTML('<b>${title.replace(/'/g, "\\'")}</b>')).addTo(map);
  </script>
</body>
</html>`;
  }, [latitude, longitude, title, mapboxToken]);

  if (Platform.OS === 'ios') {
    return (
      <View style={[styles.wrap, style]}>
        <MapView style={styles.map} region={region} mapType="standard" showsUserLocation>
          <Marker coordinate={{ latitude, longitude }} title={title} />
        </MapView>
      </View>
    );
  }

  if (Platform.OS === 'android' && mapboxToken) {
    return (
      <View style={[styles.wrap, style]}>
        <WebView source={{ html: mapboxHtml }} style={styles.map} scrollEnabled={false} />
      </View>
    );
  }

  return (
    <View style={[styles.wrap, style]}>
      <MapView style={styles.map} region={region} mapType="standard">
        <Marker coordinate={{ latitude, longitude }} title={title} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', height: 220, borderRadius: 12, overflow: 'hidden' },
  map: { width: '100%', height: '100%' },
});
