import Header from './components/Header';
import ForecastSite from './components/ForecastSite';

function App() {
  return (
    <div className="min-h-screen bg-surface overflow-x-hidden">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-ambient-cyan" />
        <div className="absolute inset-0 bg-ambient-emerald" />
        <div className="absolute inset-0 bg-ambient-amber" />
      </div>

      <Header />

      <main className="relative z-10 max-w-[1600px] mx-auto px-4 md:px-6 pb-8">
        <div className="py-6 space-y-8">
          <ForecastSite site="ft" label="Foum Tizi" modelName="XGBoost" accent="cyan" />
          <ForecastSite site="of" label="Oulad Fares" modelName="XGBoost" accent="emerald" />
        </div>

        <footer className="relative mt-8 pt-6 border-t border-surface-border/40 text-center">
          <p className="text-[10px] text-ink-muted font-medium tracking-wide">
            SmartEMS &copy; {new Date().getFullYear()} &mdash; Powered by XGBoost &mdash; Real-time Streaming
          </p>
        </footer>
      </main>
    </div>
  );
}

export default App;
