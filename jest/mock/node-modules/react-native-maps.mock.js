// Jest stand-in for react-native-maps: the real module is native and can't
// run under jest. Renders children so marker labels still appear in tests.
'use strict';

const React = require('react');
const { View } = require('react-native');

const MapView = ({ children }) => <View>{children}</View>;
const Marker = ({ children }) => <View>{children}</View>;
const Polyline = () => null;
const UrlTile = () => null;

module.exports = {
  __esModule: true,
  default: MapView,
  MapView,
  Marker,
  Polyline,
  UrlTile,
};