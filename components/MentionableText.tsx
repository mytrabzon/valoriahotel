import { Text, type StyleProp, type TextStyle } from 'react-native';

type MentionableTextProps = {
  text: string;
  textStyle?: StyleProp<TextStyle>;
  mentionStyle?: StyleProp<TextStyle>;
  resolveMentionHref?: (mentionToken: string) => string | null;
  onMentionPress?: (href: string) => void;
};

const MENTION_REGEX = /@([\p{L}\p{N}_.-]{2,32})/gu;

export function MentionableText({
  text,
  textStyle,
  mentionStyle,
  resolveMentionHref,
  onMentionPress,
}: MentionableTextProps) {
  const chunks = text.split(MENTION_REGEX);
  return (
    <Text style={textStyle}>
      {chunks.map((chunk, index) => {
        if (index % 2 === 0) {
          return <Text key={`txt-${index}`}>{chunk}</Text>;
        }
        const token = (chunk ?? '').trim();
        const label = `@${token}`;
        if (!token || !resolveMentionHref || !onMentionPress) {
          return (
            <Text key={`mnt-${index}`} style={mentionStyle}>
              {label}
            </Text>
          );
        }
        return (
          <Text
            key={`mnt-${index}`}
            style={mentionStyle}
            onPress={() => {
              const href = resolveMentionHref(token);
              if (href) onMentionPress(href);
            }}
            suppressHighlighting
          >
            {label}
          </Text>
        );
      })}
    </Text>
  );
}
