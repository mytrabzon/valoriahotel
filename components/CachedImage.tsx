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
      /** 0: disk önbelleğinden anında gösterim; gezinmede “sonradan geliyor” hissini azaltır */
      transition={props.transition ?? 0}
      priority={props.priority ?? 'high'}
    />
  );
});

