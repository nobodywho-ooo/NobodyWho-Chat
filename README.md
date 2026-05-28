[![Discord](https://img.shields.io/discord/1308812521456799765?logo=discord&style=flat-square)](https://discord.gg/qhaMc2qCYB)
[![Matrix](https://img.shields.io/badge/Matrix-000?logo=matrix&logoColor=fff)](https://matrix.to/#/#nobodywho:matrix.org)
[![Mastodon](https://img.shields.io/badge/Mastodon-6364FF?logo=mastodon&logoColor=fff&style=flat-square)](https://mastodon.gamedev.place/@nobodywho)
[![Docs](https://img.shields.io/badge/Docs-lightblue?style=flat-square)](https://docs.nobodywho.ooo)

# NobodyWho Mobile App

Demonstrates the capabilities of **[NobodyWho](https://github.com/nobodywho-ooo/nobodywho)**, a library designed to run LLMs locally and efficiently on any device.

## Features

- **Chat** — stream responses from a local LLM
- **Tool calling** — give the model access to custom functions (e.g. weather, calculator)
- **Vision & Hearing** — image & audio ingestion with a multimodal model
- **Embeddings & RAG** — semantic search with an embedding model and cross-encoder reranker

## 1. Getting Started

First, you will need to run `npm install` to install dependencies.
For iOS, install pods with `cd ios && pod install && cd ..`

### 2. Run the App

```sh
# Android
npm run android

# iOS
npm run iOS
```

**Note:** 

For iOS, if you have issues with metro, run `npm start` and then run the project on Xcode.

The script `Copy Optional Assets` in `Xcode > Build Phases` copies files in `assets` folder (in debug mode only)

#### Miscellaneous

Update tests

```sh
npm run test-update
```

iOS cleanup

```sh
make ios-clean
```

Watchman cleanup

```sh
make clean
```
