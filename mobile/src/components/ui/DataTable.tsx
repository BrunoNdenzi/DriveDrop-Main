/**
 * DataTable — Enterprise Operations component (React Native)
 *
 * Renders a dense, scannable table for operational data.
 * Supports sortable columns, row selection highlights, and status badges.
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { key: 'id', title: 'ID', width: 80 },
 *       { key: 'status', title: 'Status' },
 *       { key: 'origin', title: 'Origin', flex: 1 },
 *     ]}
 *     data={shipments}
 *     onRowPress={(item) => navigate(item.id)}
 *     keyExtractor={(item) => item.id}
 *   />
 */
import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {
  Colors,
  NeutralColors,
  Typography,
  Spacing,
  ComponentTokens,
  BorderRadius,
  Shadows,
} from '../../constants/DesignSystem';

export interface DataTableColumn<T> {
  /** Unique key matching a property on the data item */
  key: string;
  /** Column header text */
  title: string;
  /** Fixed width in pixels */
  width?: number;
  /** Flex value for remaining space */
  flex?: number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Custom cell renderer */
  render?: (item: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  onRowPress?: (item: T, index: number) => void;
  /** Row highlighted when this returns true */
  isRowHighlighted?: (item: T) => boolean;
  emptyMessage?: string;
  style?: ViewStyle;
  /** Show row index column */
  showIndex?: boolean;
  /** Max height before scrolling */
  maxHeight?: number;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyExtractor,
  onRowPress,
  isRowHighlighted,
  emptyMessage = 'No data',
  style,
  showIndex = false,
  maxHeight,
}: DataTableProps<T>) {
  const renderHeader = useCallback(() => (
    <View style={styles.headerRow}>
      {showIndex && (
        <View style={[styles.cell, styles.indexCell]}>
          <Text style={styles.headerText}>#</Text>
        </View>
      )}
      {columns.map((col) => (
        <View
          key={col.key}
          style={[
            styles.cell,
            col.width ? { width: col.width } : { flex: col.flex || 1 },
          ]}
        >
          <Text
            style={[
              styles.headerText,
              col.align === 'right' && styles.textRight,
              col.align === 'center' && styles.textCenter,
            ]}
            numberOfLines={1}
          >
            {col.title}
          </Text>
        </View>
      ))}
    </View>
  ), [columns, showIndex]);

  const renderRow = useCallback(({ item, index }: { item: T; index: number }) => {
    const highlighted = isRowHighlighted?.(item) || false;
    const RowWrapper = onRowPress ? TouchableOpacity : View;

    return (
      <RowWrapper
        style={[
          styles.dataRow,
          index % 2 === 0 && styles.dataRowEven,
          highlighted && styles.dataRowHighlighted,
        ]}
        activeOpacity={0.7}
        {...(onRowPress ? { onPress: () => onRowPress(item, index) } : {})}
      >
        {showIndex && (
          <View style={[styles.cell, styles.indexCell]}>
            <Text style={styles.indexText}>{index + 1}</Text>
          </View>
        )}
        {columns.map((col) => (
          <View
            key={col.key}
            style={[
              styles.cell,
              col.width ? { width: col.width } : { flex: col.flex || 1 },
            ]}
          >
            {col.render ? (
              col.render(item, index)
            ) : (
              <Text
                style={[
                  styles.cellText,
                  col.align === 'right' && styles.textRight,
                  col.align === 'center' && styles.textCenter,
                ]}
                numberOfLines={1}
              >
                {item[col.key] != null ? String(item[col.key]) : '—'}
              </Text>
            )}
          </View>
        ))}
      </RowWrapper>
    );
  }, [columns, onRowPress, isRowHighlighted, showIndex]);

  const renderEmpty = useCallback(() => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>{emptyMessage}</Text>
    </View>
  ), [emptyMessage]);

  return (
    <View style={[styles.container, maxHeight ? { maxHeight } : undefined, style]}>
      {renderHeader()}
      <FlatList
        data={data}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: ComponentTokens.table.borderColor,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: NeutralColors.gray[50],
    borderBottomWidth: 1,
    borderBottomColor: ComponentTokens.table.borderColor,
    minHeight: ComponentTokens.table.headerHeight,
    alignItems: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    minHeight: ComponentTokens.table.rowHeight,
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: NeutralColors.gray[200],
  },
  dataRowEven: {
    backgroundColor: NeutralColors.gray[50],
  },
  dataRowHighlighted: {
    backgroundColor: '#EFF6FF',
  },
  cell: {
    paddingHorizontal: ComponentTokens.table.cellPadding.horizontal,
    paddingVertical: ComponentTokens.table.cellPadding.vertical,
  },
  indexCell: {
    width: 40,
    alignItems: 'center',
  },
  headerText: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold as TextStyle['fontWeight'],
    color: NeutralColors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cellText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.primary,
  },
  indexText: {
    fontSize: Typography.fontSize.xs,
    color: NeutralColors.gray[400],
  },
  textRight: {
    textAlign: 'right',
  },
  textCenter: {
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: Spacing[8],
    alignItems: 'center',
  },
  emptyText: {
    fontSize: Typography.fontSize.sm,
    color: NeutralColors.gray[400],
  },
});

export default DataTable;
