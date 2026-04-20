import React, { useState } from 'react';
import { View, Image, StyleSheet, ActivityIndicator, ImageProps, Animated } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface LazyImageProps extends ImageProps {
    containerStyle?: any;
    placeholderColor?: string;
    showLoader?: boolean;
}

export const LazyImage = React.memo(({
    source,
    style,
    containerStyle,
    placeholderColor,
    showLoader = true,
    ...props
}: LazyImageProps) => {
    const { colors } = useTheme();
    const [loaded, setLoaded] = useState(false);
    const opacity = React.useRef(new Animated.Value(0)).current;

    const handleLoad = () => {
        setLoaded(true);
        Animated.timing(opacity, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    };

    return (
        <View style={[
            styles.container,
            containerStyle,
            !containerStyle && style && {
                width: (style as any).width,
                height: (style as any).height,
                borderRadius: (style as any).borderRadius
            },
            { backgroundColor: placeholderColor || colors.backgroundSecondary }
        ]}>
            {!loaded && showLoader && (
                <View style={styles.loader}>
                    <ActivityIndicator size="small" color={colors.primary} />
                </View>
            )}
            <Animated.Image
                {...props}
                source={source}
                style={[style, { opacity }]}
                onLoad={handleLoad}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    loader: {
        position: 'absolute',
        zIndex: 1,
    },
});
