import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const DashboardShimmer: React.FC = () => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmerAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ]),
    );
    shimmerAnimation.start();

    return () => shimmerAnimation.stop();
  }, [shimmerAnim]);

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const ShimmerBox = ({
    width: boxWidth,
    height,
    borderRadius = 8,
    marginBottom = 8,
  }: any) => (
    <Animated.View
      style={[
        styles.shimmerBox,
        {
          width: boxWidth,
          height,
          borderRadius,
          marginBottom,
          opacity: shimmerOpacity,
        },
      ]}
    />
  );

  const ShimmerCircle = ({ size, marginBottom = 8 }: any) => (
    <Animated.View
      style={[
        styles.shimmerCircle,
        {
          width: size,
          height: size,
          marginBottom,
          opacity: shimmerOpacity,
        },
      ]}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f6fafc" />

      {/* Header Shimmer (left only) */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <ShimmerCircle size={40} />
          <ShimmerBox width={120} height={20} />
        </View>
        {/* headerRight shimmer removed */}
      </View>

      {/* Profile Card shimmer removed */}

      {/* Stats Section Shimmer */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <ShimmerBox width={80} height={14} marginBottom={8} />
          <View style={styles.statValueContainer}>
            <ShimmerBox width={60} height={24} />
            <ShimmerCircle size={20} />
          </View>
        </View>
        <View style={styles.statCard}>
          <ShimmerBox width={80} height={14} marginBottom={8} />
          <View style={styles.statValueContainer}>
            <ShimmerBox width={60} height={24} />
            <ShimmerCircle size={20} />
          </View>
        </View>
      </View>

      {/* Quick Actions Shimmer */}
      <View style={styles.quickActionsCard}>
        <View style={styles.sectionHeader}>
          <ShimmerBox width={120} height={18} />
          <ShimmerBox width={60} height={24} borderRadius={20} />
        </View>
        <View style={styles.quickActionsGrid}>
          {[1, 2, 3, 4, 5, 6].map(item => (
            <View key={item} style={styles.actionItem}>
              <ShimmerCircle size={28} marginBottom={8} />
              <ShimmerBox width={60} height={14} />
            </View>
          ))}
        </View>
      </View>

      {/* GST Summary Shimmer */}
      <View style={styles.card}>
        <ShimmerBox width={120} height={18} marginBottom={4} />
        <ShimmerBox width={180} height={14} marginBottom={16} />
        <View style={styles.chartContainer}>
          <ShimmerCircle size={180} />
        </View>
        <View style={styles.gstLegend}>
          {[1, 2, 3].map(item => (
            <View key={item} style={styles.legendItem}>
              <ShimmerCircle size={12} />
              <ShimmerBox width={40} height={14} />
              <ShimmerBox width={60} height={14} />
            </View>
          ))}
        </View>
      </View>

      {/* Recent Transactions Shimmer */}
      <View style={styles.card}>
        <ShimmerBox width={160} height={18} marginBottom={16} />
        {[1, 2, 3, 4, 5].map(item => (
          <View key={item} style={styles.transactionItem}>
            <View style={styles.transactionLeft}>
              <ShimmerBox
                width={60}
                height={20}
                borderRadius={4}
                marginBottom={4}
              />
              <View>
                <ShimmerBox width={100} height={16} marginBottom={2} />
                <ShimmerBox width={80} height={12} />
              </View>
            </View>
            <View style={styles.transactionRight}>
              <ShimmerBox width={80} height={16} marginBottom={4} />
              <ShimmerBox width={60} height={16} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>

      {/* Cash Flow Shimmer */}
      <View style={styles.card}>
        <ShimmerBox width={160} height={18} marginBottom={4} />
        <ShimmerBox width={200} height={14} marginBottom={16} />
        <View style={styles.chartContainer}>
          <ShimmerBox width={width - 64} height={220} borderRadius={16} />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6fafc',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileCard: {
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    backgroundColor: '#e3f2fd',
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileDetails: {
    flex: 1,
    marginLeft: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    marginTop: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    width: '48%',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  statValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickActionsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionItem: {
    width: '48%',
    height: 100,
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  chartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  gstLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transactionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  shimmerBox: {
    backgroundColor: '#e0e0e0',
  },
  shimmerCircle: {
    backgroundColor: '#e0e0e0',
    borderRadius: 50,
  },
});

export default DashboardShimmer;
