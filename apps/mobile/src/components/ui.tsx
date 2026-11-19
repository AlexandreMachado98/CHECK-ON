import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { STATUS_LABEL } from '../lib/rules';

/** Cores do portal CHECK-ON (verde esmeralda + cinza azulado). */
export const colors = {
  primary: '#059669',
  primaryDark: '#047857',
  primarySoft: '#ECFDF5',
  text: '#0F172A',
  muted: '#64748B',
  border: '#E2E8F0',
  background: '#F8FAFC',
  card: '#FFFFFF',
  danger: '#BE123C',
  dangerSoft: '#FFF1F2',
  warning: '#B45309',
  warningSoft: '#FFFBEB',
  info: '#0369A1',
  infoSoft: '#F0F9FF',
};

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'outline' | 'danger' | 'ghost';
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  large?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, icon, style, large, ...props }: ButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        variant === 'primary' && { backgroundColor: pressed ? colors.primaryDark : colors.primary },
        variant === 'danger' && { backgroundColor: pressed ? '#9F1239' : colors.danger },
        variant === 'outline' && [styles.buttonOutline, pressed && { backgroundColor: colors.background }],
        variant === 'ghost' && [styles.buttonGhost, pressed && { backgroundColor: colors.border }],
        inactive && { opacity: 0.55 },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? colors.primary : '#fff'} />
      ) : (
        <View style={styles.buttonContent}>
          {icon}
          <Text
            style={[
              styles.buttonText,
              large && { fontSize: 18 },
              (variant === 'outline' || variant === 'ghost') && { color: colors.text },
            ]}
          >
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  LIBERADO: { bg: colors.primarySoft, fg: colors.primaryDark },
  ATENCAO: { bg: colors.warningSoft, fg: colors.warning },
  BLOQUEADO: { bg: colors.dangerSoft, fg: colors.danger },
};

export function StatusBadge({ status }: { status: string }) {
  const palette = STATUS_COLORS[status] ?? { bg: colors.background, fg: colors.muted };
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{STATUS_LABEL[status] ?? status}</Text>
    </View>
  );
}

export function Tag({ text, tone = 'muted' }: { text: string; tone?: 'muted' | 'danger' | 'warning' | 'info' }) {
  const palette = {
    muted: { bg: colors.background, fg: colors.muted },
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    info: { bg: colors.infoSoft, fg: colors.info },
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.badgeText, { color: palette.fg }]}>{text}</Text>
    </View>
  );
}

export function Banner({ tone, title, children }: { tone: 'danger' | 'warning' | 'info' | 'success'; title: string; children?: ReactNode }) {
  const palette = {
    danger: { bg: colors.dangerSoft, fg: colors.danger },
    warning: { bg: colors.warningSoft, fg: colors.warning },
    info: { bg: colors.infoSoft, fg: colors.info },
    success: { bg: colors.primarySoft, fg: colors.primaryDark },
  }[tone];
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.fg + '33' }]}>
      <Text style={[styles.bannerTitle, { color: palette.fg }]}>{title}</Text>
      {typeof children === 'string' ? <Text style={styles.bannerText}>{children}</Text> : children}
    </View>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLarge: { minHeight: 60, borderRadius: 14 },
  buttonOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  badge: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 12, fontWeight: '700' },
  banner: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 4 },
  bannerTitle: { fontSize: 15, fontWeight: '700' },
  bannerText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  text: { fontSize: 15, color: colors.text, lineHeight: 21 },
  muted: { fontSize: 14, color: colors.muted, lineHeight: 20 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 17,
    color: colors.text,
    backgroundColor: colors.card,
  },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
});
