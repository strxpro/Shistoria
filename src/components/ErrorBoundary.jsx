import React from 'react';

// Granica błędów — łapie wyjątki w poddrzewie i renderuje fallback zamiast
// białego ekranu ("client-side exception"). Pokazuje treść błędu, by dało się
// go zdiagnozować bezpośrednio na urządzeniu (np. iPhone bez konsoli).
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: '', stack: '' };
  }
  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      msg: (error && (error.message || String(error))) || 'Unknown error',
      stack: (error && error.stack) ? String(error.stack).split('\n').slice(0, 4).join('\n') : '',
    };
  }
  componentDidCatch(error, info) {
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        // przekaż treść błędu do fallbacku jeśli to funkcja
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.msg, this.state.stack)
          : this.props.fallback;
      }
      return null;
    }
    return this.props.children;
  }
}
