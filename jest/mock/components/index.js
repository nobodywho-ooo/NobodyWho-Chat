/* React Native */
jest.mock("react-native/Libraries/Components/Touchable/TouchableOpacity", () => "TouchableOpacity");

/* Shared Components */
jest.mock("../../../app/components/ListItem/ListItem", () => ({ ListItem: 'ListItem' }));
jest.mock("../../../app/components/PlatformIcon/PlatformIcon", () => ({ PlatformIcon: 'PlatformIcon' }));
jest.mock("../../../app/components/Text/Text", () => ({
  Text: 'Text',
  fontSizes: { h1: 32, h2: 28, h3: 24, h4: 20, body1: 16, body2: 14, caption: 12 },
}));
jest.mock("../../../app/components/Button/Button", () => ({ Button: 'Button' }));
jest.mock("../../../app/components/ModelCard/ModelCard", () => ({ ModelCard: 'ModelCard' }));
jest.mock("../../../app/components/ProgressBar/ProgressBar", () => ({ ProgressBar: 'ProgressBar' }));
jest.mock("../../../app/components/IconButton/IconButton", () => ({ IconButton: 'IconButton' }));

/* Screens Components */
jest.mock("../../../app/screens/DrawerContentScreen/components/ConversationsList/ConversationsList", () => ({ ConversationsList: 'ConversationsList' }));
jest.mock("../../../app/screens/ChatScreen/components/InputBar/InputBar", () => ({ InputBar: 'InputBar' }));