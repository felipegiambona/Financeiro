import { Feather } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

interface PaymentCelebrationProps {
  description: string;
  onDone: () => void;
}

const CONFETTI = [
  { x: -118, y: -92, rotation: -28, size: 7, delay: 80 },
  { x: -84, y: -134, rotation: 42, size: 5, delay: 140 },
  { x: -38, y: -112, rotation: 18, size: 6, delay: 30 },
  { x: 26, y: -126, rotation: -44, size: 7, delay: 170 },
  { x: 75, y: -102, rotation: 32, size: 5, delay: 60 },
  { x: 116, y: -62, rotation: -18, size: 6, delay: 210 },
  { x: -126, y: 34, rotation: 34, size: 5, delay: 190 },
  { x: -86, y: 82, rotation: -42, size: 7, delay: 40 },
  { x: -35, y: 106, rotation: 16, size: 5, delay: 150 },
  { x: 33, y: 112, rotation: -30, size: 6, delay: 90 },
  { x: 84, y: 80, rotation: 44, size: 7, delay: 230 },
  { x: 126, y: 28, rotation: -12, size: 5, delay: 120 },
];

function ConfettiPiece({
  piece,
  color,
}: {
  piece: (typeof CONFETTI)[number];
  color: string;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 1650,
      delay: piece.delay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [piece.delay, progress]);

  const animatedStyle = {
    opacity: progress.interpolate({
      inputRange: [0, 0.08, 0.72, 1],
      outputRange: [0, 1, 1, 0],
    }),
    transform: [
      { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.x] }) },
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, piece.y] }) },
      { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${piece.rotation}deg`] }) },
      { scale: progress.interpolate({ inputRange: [0, 0.18, 1], outputRange: [0.4, 1, 0.85] }) },
    ],
  };

  return <Animated.View style={[styles.confetti, { width: piece.size, height: piece.size * 1.7, backgroundColor: color }, animatedStyle]} />;
}

export function PaymentCelebration({ description, onDone }: PaymentCelebrationProps) {
  const colors = useColors();
  const cardProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.sequence([
      Animated.timing(cardProgress, { toValue: 1, duration: 320, useNativeDriver: true }),
      Animated.delay(1450),
      Animated.timing(cardProgress, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]);

    animation.start(({ finished }) => {
      if (finished) onDone();
    });

    return () => animation.stop();
  }, [cardProgress, onDone]);

  const cardStyle = {
    opacity: cardProgress,
    transform: [
      {
        scale: cardProgress.interpolate({
          inputRange: [0, 0.65, 1],
          outputRange: [0.82, 1.04, 1],
        }),
      },
    ],
  };

  const confettiColors = [colors.primary, colors.income, colors.accent, colors.paid, colors.expense];

  return (
    <View pointerEvents="none" style={styles.overlay}>
      <View style={styles.backdrop} />
      {CONFETTI.map((piece, index) => (
        <ConfettiPiece key={`${piece.x}-${piece.y}`} piece={piece} color={confettiColors[index % confettiColors.length]} />
      ))}
      <Animated.View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.paid }, cardStyle]}>
        <View style={[styles.icon, { backgroundColor: colors.paidSoft }]}>
          <Feather name="check" size={25} color={colors.paid} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>Pagamento registrado!</Text>
        <Text numberOfLines={2} style={[styles.description, { color: colors.mutedForeground }]}>
          {description}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0, 0, 0, 0.12)' },
  card: { width: '78%', maxWidth: 310, borderRadius: 16, borderWidth: 1, paddingHorizontal: 20, paddingVertical: 19, alignItems: 'center' },
  icon: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 16, fontFamily: 'Inter_700Bold', textAlign: 'center' },
  description: { maxWidth: 240, fontSize: 11, lineHeight: 16, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 6 },
  confetti: { position: 'absolute', borderRadius: 2 },
});