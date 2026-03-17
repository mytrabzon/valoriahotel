import { Image as ExpoImage, type ImageProps } from 'expo-image';
import { memo } from 'react';

type Props = ImageProps & {
  uri?: string | null;
};

export const CachedImage = memo(function CachedImage({ uri, source, ...props }: Props) {
  const finalSource = source ?? (uri ? { uri } : undefined);
  if (!finalSource) return null;
  return (
    <ExpoImage
      {...props}
      source={finalSource}
      cachePolicy={props.cachePolicy ?? 'disk'}
      transition={props.transition ?? 180}
    />
  );
});

