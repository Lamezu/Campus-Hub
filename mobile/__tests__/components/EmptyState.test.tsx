jest.mock('@/contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: 'light',
    colors: {
      primary: '#007AFF',
      text: '#1C1C1E',
      textSecondary: '#636366',
      border: '#C6C6C8',
      background: '#FFFFFF',
      backgroundSecondary: '#F2F2F7',
    },
  }),
}));

import React from 'react';
import { View } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';

const MockIcon: React.ComponentType<{ size: number; color: string; strokeWidth: number }> = () => (
  <View testID="mock-icon" />
);

describe('EmptyState', () => {
  it('renders the title', () => {
    const { getByText } = render(<EmptyState icon={MockIcon} title="No items found" />);
    expect(getByText('No items found')).toBeTruthy();
  });

  it('renders the icon', () => {
    const { getByTestId } = render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(getByTestId('mock-icon')).toBeTruthy();
  });

  it('renders body text when provided', () => {
    const { getByText } = render(
      <EmptyState icon={MockIcon} title="Empty" body="Nothing to show here." />
    );
    expect(getByText('Nothing to show here.')).toBeTruthy();
  });

  it('does not render body text when omitted', () => {
    const { queryByText } = render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(queryByText('Nothing to show here.')).toBeNull();
  });

  it('renders the action button when action is provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState icon={MockIcon} title="Empty" action={{ label: 'Add item', onPress }} />
    );
    expect(getByText('Add item')).toBeTruthy();
  });

  it('calls action.onPress when button is pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState icon={MockIcon} title="Empty" action={{ label: 'Add item', onPress }} />
    );
    fireEvent.press(getByText('Add item'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when action is omitted', () => {
    const { queryByText } = render(<EmptyState icon={MockIcon} title="Empty" />);
    expect(queryByText('Add item')).toBeNull();
  });

  it('renders body and action together', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <EmptyState
        icon={MockIcon}
        title="No documents"
        body="Add the first document to get started."
        action={{ label: 'Add document', onPress }}
      />
    );
    expect(getByText('No documents')).toBeTruthy();
    expect(getByText('Add the first document to get started.')).toBeTruthy();
    expect(getByText('Add document')).toBeTruthy();
  });
});
