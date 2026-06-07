import React from 'react';

// Granica błędów — łapie wyjątki w poddrzewie i renderuje fallback zamiast
// białego ekranu ("client-side exception"). Pozwala reszcie strony działać.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    // log do konsoli (widoczne w devtools), nie wywala całej apki
    if (typeof console !== 'undefined') console.error('[ErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
