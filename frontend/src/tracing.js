import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

// 初始化 Web Tracer Provider，显式设置前端服务名，便于在收集器中区分
const provider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'react-frontend'
  })
});

// OTLP HTTP 导出器，指向本地迷你收集器
const exporter = new OTLPTraceExporter({
  url: 'http://localhost:4318/v1/traces'
});

provider.addSpanProcessor(new BatchSpanProcessor(exporter));

provider.register();

const tracer = provider.getTracer('react-frontend-ui');

// 捕获前端运行时错误，生成一个简单的 error span 上报到迷你收集器
window.addEventListener('error', (event) => {
  try {
    const span = tracer.startSpan('ui.error');
    span.recordException(event.error || event.message || 'Unknown UI error');
    span.setAttribute('ui.error.message', String(event.message || ''));
    span.setAttribute('ui.error.filename', event.filename || '');
    span.setAttribute('ui.error.lineno', event.lineno || 0);
    span.setAttribute('ui.error.colno', event.colno || 0);
    span.end();
  } catch {
    // 避免监控代码本身再抛错
  }
});

// 自动采集 fetch 请求（包括我们点击按钮触发的 /api/a/... 请求）
registerInstrumentations({
  instrumentations: [
    new FetchInstrumentation({
      propagateTraceHeaderCorsUrls: [/localhost:8081/]
    })
  ]
});


