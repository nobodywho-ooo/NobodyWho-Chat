/* React Native */
jest.mock("react-native/Libraries/Components/Touchable/TouchableOpacity", () => "TouchableOpacity");

/* Shared Components */
jest.mock("../../../app/components/ListItem/ListItem", () => ({ ListItem: 'ListItem' }));
jest.mock("../../../app/components/PlatformIcon/PlatformIcon", () => ({ PlatformIcon: 'PlatformIcon' }));
jest.mock("../../../app/components/Text/Text", () => ({ Text: 'Text' }));
jest.mock("../../../app/components/Button/Button", () => ({ Button: 'Button' }));
jest.mock("../../../app/components/InputBar/InputBar", () => ({ InputBar: 'InputBar' }));
jest.mock("../../../app/components/ModelCard/ModelCard", () => ({ ModelCard: 'ModelCard' }));
jest.mock("../../../app/components/ProgressBar/ProgressBar", () => ({ ProgressBar: 'ProgressBar' }));
jest.mock("../../../app/components/IconButton/IconButton", () => ({ IconButton: 'IconButton' }));
jest.mock("../../../app/components/ConversationList/ConversationList", () => ({ ConversationList: 'ConversationList' }));