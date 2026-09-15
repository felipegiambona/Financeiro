import React from 'react';

function flattenStyle(style) {
  const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
  if (!Array.isArray(resolvedStyle)) {
    return resolvedStyle;
  }

  return Object.assign({}, ...resolvedStyle.filter(Boolean));
}

function primitive(elementType) {
  return function Primitive({
    accessibilityLabel,
    accessibilityRole,
    children,
    onPress,
    style,
    ...nativeProps
  }) {
    const domProps = Object.fromEntries(
      Object.entries(nativeProps).filter(([name]) => !nativeOnlyProps.has(name)),
    );

    return React.createElement(
      elementType,
      {
        ...domProps,
        'aria-label': accessibilityLabel,
        role: accessibilityRole,
        onClick: onPress,
        style: flattenStyle(style),
      },
      children,
    );
  };
}

const nativeOnlyProps = new Set([
  'animationType',
  'contentContainerStyle',
  'selectable',
  'showsVerticalScrollIndicator',
  'transparent',
  'visible',
]);

export const Modal = primitive('section');
export const Pressable = primitive('button');
export const ScrollView = primitive('div');
export const Text = primitive('span');
export const View = primitive('div');

export const Platform = {
  select: (options) => options.default,
};

export const StyleSheet = {
  create: (styles) => styles,
};