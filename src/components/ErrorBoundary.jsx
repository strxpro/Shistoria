import React from 'react';

// Granica błędów — łapie wyjątki w poddrzewie i renderuje fallback zamiast
// białego ekranu ("client-side exception"). Pokazuje treść błędu, by dało się
// go zdiagnozować bezpośrednio na urządzeniu (np. iPhone bez konsoli).
//
// autoRetry (opcjonalnie): liczba automatycznych prób ponownego zamontowania
// dzieci po błędzie (np. transient "Error creating WebGL context" — czasem
// pierwszy kontekst pada, kolejny wchodzi). Po wyczerpaniu prób → fallback.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, msg: '', stack: '', tries: 0, retryKey: 0 };
    this._timer = null;
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
    const max = Number(this.props.autoRetry || 0);
    if (max > 0 && this.state.tries < max) {
      // Ponów montowanie po krótkiej zwłoce (rosnącej) — daje GPU czas na reset
      const delay = 700 + this.state.tries * 900;
      this._timer = setTimeout(() => {
        this.setState((s) => ({ hasError: false, msg: '', stack: '', tries: s.tries + 1, retryKey: s.retryKey + 1 }));
      }, delay);
    }
  }
  componentWillUnmount() { if (this._timer) clearTimeout(this._timer); }
  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return typeof this.props.fallback === 'function'
          ? this.props.fallback(this.state.msg, this.state.stack)
          : this.props.fallback;
      }
      return null;
    }
    // retryKey wymusza świeży remount poddrzewa (nowa próba kontekstu WebGL)
    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}
