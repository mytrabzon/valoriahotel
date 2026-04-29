import React from 'react';
import { StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { profileScreenTheme as P } from '../constants/profileScreenTheme';

type ProfileCoverFrameProps = {
  children: React.ReactNode;
  /** İçerik genişliği; verilmezse pencere − 2×inset (inset=0 iken tam genişlik) */
  width?: number;
  style?: ViewStyle;
  /** Tema `marginTop`’u bastır (varsayılan 0) */
  flushTop?: boolean;
};

/**
 * Profil kapak: tam ekran genişliği (inset=0), üst hizası boşluk yok, yuvarlama sadece altta.
 * Çerçeve çizgisi overlay; gölge dış sarmalayıcıda; üstte border yok.
 */
export function ProfileCoverFrame({ children, width: widthOverride, style, flushTop }: ProfileCoverFrameProps) {
  const { width: windowWidth } = useWindowDimensions();
  const inset = P.coverFrame.inset;
  const w = widthOverride ?? windowWidth - 2 * inset;
  return (
    <View
      style={[
        styles.wrap,
        {
          width: w,
          minWidth: w,
          maxWidth: w,
          marginTop: flushTop ? 0 : P.coverFrame.marginTop,
        },
        style,
      ]}
    >
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    overflow: 'hidden',
  },
  body: {
    width: '100%',
    minWidth: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
});
