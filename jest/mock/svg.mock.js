const React = require('react');

// Stubs out `*.svg` imports (handled by react-native-svg-transformer in the
// real bundle) so Jest renders them as a simple host component in snapshots.
const SvgMock = props => React.createElement('SvgMock', props);

module.exports = SvgMock;
module.exports.default = SvgMock;
