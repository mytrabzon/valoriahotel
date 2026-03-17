import React from 'react';
import { View, StyleSheet, ImageSourcePropType } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

export type QRShape = 'square' | 'rounded' | 'dots' | 'circle';

export type QRDesign = {
  useLogo: boolean;
  backgroundColor: string;
  foregroundColor: string;
  shape: QRShape;
  logoSizeRatio?: number;
};

type DesignableQRProps = {
  value: string;
  size?: number;
  design: QRDesign;
  logo?: ImageSourcePropType;
};

const defaultLogo = require('../assets/icon.png');

/** Sade QR: beyaz/siyah veya seçilen iki renk, isteğe bağlı logo. Karışık görünüm yok. */
export function DesignableQR({ value, size = 180, design, logo = defaultLogo }: DesignableQRProps) {
  const {
    useLogo,
    backgroundColor,
    foregroundColor,
    shape,
    logoSizeRatio = 0.22,
  } = design;

  const logoSize = Math.round(size * (logoSizeRatio || 0.22));
  const isCircle = shape === 'circle';
  const isRounded = shape === 'rounded' || shape === 'dots';
  const borderRadius = isCircle ? size / 2 : isRounded ? Math.min(size * 0.12, 16) : 0;

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius,
          backgroundColor,
          overflow: isCircle || isRounded ? 'hidden' : 'visible',
        },
      ]}
    >
      <QRCode
        value={value}
        size={size}
        color={foregroundColor}
        backgroundColor={backgroundColor}
        logo={useLogo ? logo : undefined}
        logoSize={useLogo ? logoSize : undefined}
        logoBackgroundColor={backgroundColor}
        logoMargin={2}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
