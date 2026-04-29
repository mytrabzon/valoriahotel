import { Linking, StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

type LinkifiedTextProps = {
  text: string;
  textStyle?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
};

const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

function normalizeUrl(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function LinkifiedText({ text, textStyle, linkStyle }: LinkifiedTextProps) {
  const chunks = text.split(URL_REGEX);
  return (
    <Text style={textStyle}>
      {chunks.map((chunk, index) => {
        const isLink = URL_REGEX.test(chunk);
        URL_REGEX.lastIndex = 0;
        if (!isLink) return <Text key={`txt-${index}`}>{chunk}</Text>;
        const url = normalizeUrl(chunk);
        if (!url) return <Text key={`txt-${index}`}>{chunk}</Text>;
        return (
          <Text
            key={`lnk-${index}`}
            style={[styles.link, linkStyle]}
            onPress={() => {
              Linking.openURL(url).catch(() => {});
            }}
            suppressHighlighting
          >
            {chunk}
          </Text>
        );
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    textDecorationLine: 'underline',
  },
});
