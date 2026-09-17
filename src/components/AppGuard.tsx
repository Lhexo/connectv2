import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class AppGuard extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('AppGuard caught an error:', error, errorInfo);
  }

  public render() {
    console.log('AppGuard rendering, hasError:', this.state.hasError);
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-[#1A1A1A]/5 p-12 text-center space-y-8">
            <div className="w-24 h-24 bg-rose-50 rounded-full flex items-center justify-center mx-auto text-rose-500">
              <AlertTriangle size={48} />
            </div>
            
            <div className="space-y-3">
              <h1 className="text-3xl font-serif font-bold text-[#111827]">Ops! Qualcosa è andato storto</h1>
              <p className="text-[#1A1A1A]/60 leading-relaxed">
                Si è verificato un errore imprevisto. Abbiamo segnalato il problema al team tecnico.
              </p>
            </div>

            {this.state.error && (
              <div className="p-4 bg-rose-50 rounded-2xl text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-rose-700 whitespace-pre-wrap">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-3 pt-4">
              <button 
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 bg-[#5A5A40] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#4A4A30] transition-all shadow-lg shadow-[#5A5A40]/20"
              >
                <RefreshCcw size={20} /> Riprova
              </button>
              <Link 
                to="/"
                onClick={() => this.setState({ hasError: false })}
                className="flex items-center justify-center gap-2 bg-[#F5F5F0] text-[#5A5A40] px-8 py-4 rounded-2xl font-bold hover:bg-[#E5E5E0] transition-all"
              >
                <Home size={20} /> Torna alla Home
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
