import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Heart } from 'lucide-react-native';

interface FloatingHeartProps {
  x: number;
  y: number;
  onDone: () => void;
}

export function FloatingHeart({ x, y, onDone }: FloatingHeartProps) {
  const scale = useSharedValue(0.2);
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 7, stiffness: 280 });
    translateY.value = withTiming(-140, { duration: 1100 });
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 700 }, (finished) => {
        if (finished) runOnJS(onDone)();
      });
    }, 300);
    return () => clearTimeout(timer);
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: x - 24,
          top: y - 24,
          zIndex: 999,
          pointerEvents: 'none',
        },
        animStyle,
      ]}
    >
      <Heart size={48} color="#FF3B30" fill="#FF3B30" strokeWidth={1.5} />
    </Animated.View>
  );
}
