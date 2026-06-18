import React from 'react';
import { MarkdownDocument } from 'components';

const PRIVACY_POLICY_MARKDOWN = `# Privacy Policy

This Privacy Policy explains how **NobodyWho ApS** (CVR-nr. 46025350) ("we", "us", or "our") handles information in connection with the **NobodyWho Chat** mobile application (the "App").

NobodyWho Chat is designed to be private by default: your conversations run entirely on your device.

## 1. Data We Process

**Conversations and prompts.** Everything you type, and every response a model generates, is processed locally on your device and stored only on your device. We do not collect, transmit, or have access to your conversations.

**Models.** When you choose to download a model, the App retrieves it from a third-party model provider. That request includes technical information (such as your IP address) which is handled by the provider under its own privacy policy.

**Crash reports.** The App uses [Sentry](https://sentry.io) to collect anonymous crash and error reports. If the App crashes or encounters an unexpected error, Sentry automatically sends a report containing technical information such as the device model, operating system version, app version, and a stack trace identifying where the error occurred. This data does not include your conversations, prompts, or any content you have entered into the App. Sentry processes this data on our behalf under a data-processing agreement and in accordance with its own [Privacy Policy](https://sentry.io/privacy/). You can review Sentry's data practices at sentry.io/privacy.

**Analytics and advertising.** The App does not include advertising SDKs and does not track you across other apps or websites.

## 2. How We Use Information

Because your conversations never leave your device, we do not use them for any purpose. Crash report data is used solely to identify and fix bugs and improve the stability of the App. Network requests are limited to downloading the models you explicitly request and sending crash reports when an error occurs.

## 3. Data Storage and Security

Conversations, settings, and downloaded models are stored locally on your device. You can delete this data at any time by removing conversations or models within the App, or by uninstalling the App.

## 4. Data Sharing

We do not sell your personal data. We do not have access to your conversation data and therefore cannot disclose it to anyone. Anonymous crash report data is shared with Sentry, Inc. solely for the purpose of bug detection and app stability. No conversation content is included in these reports.

## 5. Children's Privacy

The App is not directed to children under the age of 16, and we do not knowingly process personal data relating to children.

## 6. Your Rights

Under the EU General Data Protection Regulation (GDPR), you have rights regarding your personal data, including access, rectification, and erasure. Because your data is stored only on your device, you can exercise these rights directly within the App.

## 7. Changes to This Policy

We may update this Privacy Policy from time to time. Material changes will be reflected by the "Last updated" date shown above.

## 8. Contact

If you have questions about this Privacy Policy, please contact:

NobodyWho ApS
CVR-nr. 46025350
Email: info@nobodywho.ai

_Last updated: 17 June 2026_
`;

export const PrivacyPolicyScreen: React.FC = () => {
  return <MarkdownDocument markdown={PRIVACY_POLICY_MARKDOWN} />;
};
