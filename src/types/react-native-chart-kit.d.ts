declare module 'react-native-chart-kit' {
  import { Component } from 'react';
  import { ViewStyle } from 'react-native';

  export interface ChartConfig {
    backgroundColor?: string;
    backgroundGradientFrom?: string;
    backgroundGradientTo?: string;
    color?: (opacity?: number) => string;
    labelColor?: (opacity?: number) => string;
    style?: ViewStyle;
    decimalPlaces?: number;
    barPercentage?: number;
    propsForBackgroundLines?: any;
  }

  export interface AbstractChartProps {
    width: number;
    height: number;
    chartConfig: ChartConfig;
    style?: ViewStyle;
    fromZero?: boolean;
    withInnerLines?: boolean;
    withOuterLines?: boolean;
    yAxisLabel?: string;
    yAxisSuffix?: string;
  }

  export interface PieChartData {
    name: string;
    amount: number;
    color: string;
    legendFontColor?: string;
    legendFontSize?: number;
  }

  export interface PieChartProps extends AbstractChartProps {
    data: PieChartData[];
    accessor: string;
    backgroundColor?: string;
    paddingLeft?: string;
    absolute?: boolean;
    hasLegend?: boolean;
    center?: [number, number];
  }

  export class PieChart extends Component<PieChartProps> {}

  export interface BarChartProps extends AbstractChartProps {
    data: {
      labels: string[];
      datasets: {
        data: number[];
        color?: (opacity?: number) => string;
        strokeWidth?: number;
      }[];
      legend?: string[];
    };
    showBarTops?: boolean;
    showValuesOnTopOfBars?: boolean;
  }

  export class BarChart extends Component<BarChartProps> {}
}
