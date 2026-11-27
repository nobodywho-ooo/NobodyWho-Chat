import { createContext, useContext } from 'react';

interface SidebarValue {
  isSidebarLayout: boolean;
  isSidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const SidebarContext = createContext<SidebarValue>({
  isSidebarLayout: false,
  isSidebarOpen: false,
  setSidebarOpen: () => undefined,
});

export const useSidebar = () => {
  const value = useContext(SidebarContext);
  return {
    ...value,
    isSidebarShown: value.isSidebarLayout && value.isSidebarOpen,
  };
};
