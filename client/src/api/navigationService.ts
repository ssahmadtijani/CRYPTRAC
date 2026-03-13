/**
 * Navigation singleton for use outside React components (e.g. Axios interceptors).
 * The navigate function is registered once by AuthContext on mount.
 */
let _navigate: ((path: string) => void) | null = null;

export const navigationService = {
  setNavigate(fn: (path: string) => void) {
    _navigate = fn;
  },
  navigate(path: string) {
    if (_navigate) {
      _navigate(path);
    } else {
      // Fallback: hard redirect if router hasn't mounted yet
      window.location.href = path;
    }
  },
};
