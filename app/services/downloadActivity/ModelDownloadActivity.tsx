import {
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  VStack,
} from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  lineLimit,
  monospacedDigit,
  padding,
  progressViewStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

export type ModelDownloadActivityIcon =
  'arrow.down.circle.fill' | 'checkmark.circle.fill' | 'pause.circle.fill';

export interface ModelDownloadActivityProps {
  // The model's name, or "2 models" when several download at once.
  title: string;
  // What is happening: "Downloading", "Downloaded", "Waiting for NobodyWho".
  subtitle: string;
  // 0..1
  progress: number;
  // The progress as text, already formatted ("42%").
  percent: string;
  icon: ModelDownloadActivityIcon;
}

// The Lock Screen banner and Dynamic Island of a model download.
//
// The 'widget' directive turns this function into source text (see the
// widgets plugin in babel.config.js) that the widget extension evaluates on its
// own JS runtime, with the props passed to start()/update(). So it may only use
// @expo/ui SwiftUI components and modifiers, plain values and its props: no
// module-scope constants, hooks, or type annotations inside it (the text is
// captured before TypeScript strips them).
export default createLiveActivity<ModelDownloadActivityProps>(
  'ModelDownload',
  props => {
    'widget';
    const accent = '#b44618';

    return {
      banner: (
        <HStack spacing={14} modifiers={[padding({ all: 16 })]}>
          <Image systemName={props.icon} size={30} color={accent} />
          <VStack alignment="leading" spacing={6}>
            <HStack>
              <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>
                {props.title}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ textStyle: 'subheadline' }),
                  monospacedDigit(),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                {props.percent}
              </Text>
            </HStack>
            <ProgressView value={props.progress} modifiers={[tint(accent)]} />
            <Text
              modifiers={[
                font({ textStyle: 'caption' }),
                foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                lineLimit(1),
              ]}
            >
              {props.subtitle}
            </Text>
          </VStack>
        </HStack>
      ),
      compactLeading: <Image systemName={props.icon} color={accent} />,
      compactTrailing: (
        <Text modifiers={[font({ textStyle: 'caption' }), monospacedDigit()]}>
          {props.percent}
        </Text>
      ),
      minimal: (
        <ProgressView
          value={props.progress}
          modifiers={[progressViewStyle('circular'), tint(accent)]}
        />
      ),
      expandedLeading: (
        <Image systemName={props.icon} size={28} color={accent} />
      ),
      expandedCenter: (
        <Text modifiers={[font({ weight: 'semibold' }), lineLimit(1)]}>
          {props.title}
        </Text>
      ),
      expandedTrailing: (
        <Text modifiers={[monospacedDigit()]}>{props.percent}</Text>
      ),
      // Centered: the expanded Dynamic Island's bottom corners are rounded, so
      // leading text runs into them.
      expandedBottom: (
        <VStack alignment="center" spacing={6}>
          <ProgressView value={props.progress} modifiers={[tint(accent)]} />
          <Text
            modifiers={[
              font({ textStyle: 'caption' }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
              lineLimit(1),
            ]}
          >
            {props.subtitle}
          </Text>
        </VStack>
      ),
    };
  },
);
