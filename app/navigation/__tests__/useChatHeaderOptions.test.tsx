import React, { ReactNode } from 'react';
import { renderHook } from '@testing-library/react-native';

import { mockUseAppState, mockUseModels } from 'jest/mock/hooks';
import { buildModel } from 'jest/factories/model';
import { AiServiceProvider } from 'services';

import { useChatHeaderOptions } from '../ChatHeader';
import { useMenuHeaderOptions } from '../MenuHeader';
import { SidebarContext } from '../Sidebar';

const renderOptions = (sidebar: {
  isSidebarLayout: boolean;
  isSidebarOpen: boolean;
}) =>
  renderHook(() => useChatHeaderOptions(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AiServiceProvider>
        <SidebarContext.Provider
          value={{ ...sidebar, setSidebarOpen: jest.fn() }}
        >
          {children}
        </SidebarContext.Provider>
      </AiServiceProvider>
    ),
  });

const leftItems = (options: Awaited<ReturnType<typeof renderOptions>>) =>
  options.result.current.unstable_headerLeftItems?.({
    tintColor: '#000',
    canGoBack: false,
  });

beforeEach(() => {
  mockUseAppState.mockReturnValue({ modelIdInUse: 1, conversationIdInUse: 5 });
  mockUseModels.mockReturnValue({ models: [buildModel(1)] });
});

test('on phones the menu button is a native bar item (iPhone Duo moves it into the vertical bar)', async () => {
  const options = await renderOptions({
    isSidebarLayout: false,
    isSidebarOpen: false,
  });

  expect(leftItems(options)).toEqual([
    expect.objectContaining({
      type: 'button',
      icon: { type: 'sfSymbol', name: 'line.3.horizontal' },
    }),
  ]);
  expect(options.result.current.headerLeft).toBeUndefined();
});

test('with the sidebar hidden, its toggle is a header view with its own glass, kept top left beside the model name', async () => {
  const options = await renderOptions({
    isSidebarLayout: true,
    isSidebarOpen: false,
  });

  expect(leftItems(options)).toEqual([
    expect.objectContaining({ type: 'custom', hidesSharedBackground: true }),
  ]);
});

test('with the sidebar shown, there is no menu button at all', async () => {
  const options = await renderOptions({
    isSidebarLayout: true,
    isSidebarOpen: true,
  });

  expect(options.result.current.unstable_headerLeftItems).toBeUndefined();
  expect(options.result.current.headerLeft).toBeUndefined();
});

test('the More menu is disabled without a conversation', async () => {
  mockUseAppState.mockReturnValue({
    modelIdInUse: 1,
    conversationIdInUse: undefined,
  });
  const options = await renderOptions({
    isSidebarLayout: false,
    isSidebarOpen: false,
  });

  const [more] =
    options.result.current.unstable_headerRightItems?.({
      tintColor: '#000',
      canGoBack: false,
    }) ?? [];
  expect(more).toEqual(
    expect.objectContaining({ type: 'menu', disabled: true }),
  );
});

test('the models and settings headers share the menu button, with their own title', async () => {
  const options = await renderHook(() => useMenuHeaderOptions('Models'), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <SidebarContext.Provider
        value={{
          isSidebarLayout: false,
          isSidebarOpen: false,
          setSidebarOpen: jest.fn(),
        }}
      >
        {children}
      </SidebarContext.Provider>
    ),
  });

  expect(options.result.current.title).toBe('Models');
  expect(leftItems(options as never)).toEqual([
    expect.objectContaining({
      type: 'button',
      icon: { type: 'sfSymbol', name: 'line.3.horizontal' },
    }),
  ]);
});
