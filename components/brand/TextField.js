import { forwardRef, useState } from 'react';
import { View, TextInput } from 'react-native';
import { RADII, FONTS } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

// The focus ring is drawn on a wrapper whose border is transparent at rest, so the
// space is always reserved and focusing never shifts layout by a pixel.
const RING = 2;
const BORDER = 1.5;

/**
 * The single text input for the whole app. Before this existed there were five
 * near-identical style blocks with four different radii, three heights, and no focus
 * state at all.
 *
 * Focus changes BOTH colour and thickness, deliberately. In dark mode `primary`
 * (#4A82E0) and `textMuted` (#8B8475) sit at 1.02:1 — practically identical luminance —
 * so a colour-only change is invisible to anyone not resolving hue. The added ring is
 * what makes focus perceivable.
 *
 * `style` goes to the wrapper (layout: flex, margins). `inputStyle` goes to the field.
 */
const TextField = forwardRef(function TextField(
  { style, inputStyle, multiline = false, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={[
        {
          borderWidth: RING,
          borderColor: focused ? colors.primary : 'transparent',
          borderRadius: RADII.md + RING,
        },
        style,
      ]}
    >
      <TextInput
        ref={ref}
        multiline={multiline}
        placeholderTextColor={colors.inputPlaceholder}
        onFocus={(e) => { setFocused(true); onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); onBlur?.(e); }}
        style={[
          {
            backgroundColor: colors.surface,
            borderWidth: BORDER,
            // Resting border is textMuted, not the hairline `border` token: at 1.40:1
            // the hairline left the field indistinguishable from the page.
            borderColor: focused ? colors.primary : colors.textMuted,
            borderRadius: RADII.md,
            paddingHorizontal: 14,
            // 16px is deliberate. Anything smaller triggers zoom-on-focus in mobile
            // Safari, which matters because this ships as an installed web app.
            fontSize: 16,
            fontFamily: FONTS.body,
            color: colors.textPrimary,
          },
          multiline
            ? { minHeight: 110, paddingTop: 12, paddingBottom: 12, textAlignVertical: 'top' }
            : { height: 52 },
          inputStyle,
        ]}
        {...rest}
      />
    </View>
  );
});

export default TextField;
