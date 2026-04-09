"use client";

import { useEffect, useState } from "react";

interface PerformanceMetrics {
  loadTime: number;
  renderTime: number;
  apiCalls: number;
}

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    loadTime: 0,
    renderTime: 0,
    apiCalls: 0,
  });

  useEffect(() => {
    const startTime = performance.now();

    // Monitor API calls
    const originalFetch = window.fetch;
    let apiCallCount = 0;

    window.fetch = async (...args) => {
      apiCallCount++;
      setMetrics((prev) => ({ ...prev, apiCalls: apiCallCount }));
      return originalFetch(...args);
    };

    // Monitor render time
    const renderStart = performance.now();

    const measureRender = () => {
      const renderTime = performance.now() - renderStart;
      const loadTime = performance.now() - startTime;

      setMetrics((prev) => ({
        ...prev,
        renderTime: Math.round(renderTime),
        loadTime: Math.round(loadTime),
      }));
    };

    // Measure after initial render
    setTimeout(measureRender, 100);

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white p-3 rounded-lg text-xs font-mono z-50">
      <div className="space-y-1">
        <div>Load: {metrics.loadTime}ms</div>
        <div>Render: {metrics.renderTime}ms</div>
        <div>API Calls: {metrics.apiCalls}</div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
