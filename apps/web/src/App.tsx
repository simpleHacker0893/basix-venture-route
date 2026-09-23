import { BrowserRouter, MemoryRouter } from "react-router";

import { AppRoutes } from "./router";

type AppProps = {
  /** Tests mount the app at a path without touching window.location. */
  initialPath?: string;
};

export function App({ initialPath }: AppProps) {
  if (initialPath !== undefined) {
    return (
      <MemoryRouter initialEntries={[initialPath]}>
        <AppRoutes />
      </MemoryRouter>
    );
  }
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
