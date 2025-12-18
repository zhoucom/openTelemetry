const express = require('express');
const bodyParser = require('body-parser');
const protobuf = require('protobufjs');

const app = express();

// 简单全局 CORS 处理，允许前端 Vite 开发服务器访问，并支持 credentials
app.use((req, res, next) => {
  const origin = req.headers.origin || 'http://localhost:5173';

  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type,traceparent,tracestate,Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});

// 只对 application/json 做 JSON 解析
app.use(
  bodyParser.json({
    type: ['application/json']
  })
);

// 对 protobuf trace 使用 raw body，后面用 protobufjs 手动解析。
// 注意：OTLP 可能带 charset，所以这里用自定义匹配函数。
app.use(
  bodyParser.raw({
    type: (req) => {
      const ct = req.headers['content-type'] || '';
      return ct.includes('application/x-protobuf');
    },
    limit: '10mb'
  })
);

// 定义最小 OTLP Trace Protobuf（只保留我们需要的字段，且不使用多 package，方便解析）
// 注意：
// 1. /v1/traces 接收的根消息是 ExportTraceServiceRequest
// 2. 各字段编号必须和官方 OTLP 定义对齐，否则会出现 “Span 名称为 undefined / traceId 看起来像字符串” 等奇怪现象
const otlpTraceProto = `
syntax = "proto3";

message AnyValue {
  oneof value {
    string string_value = 1;
  }
}

message KeyValue {
  string key = 1;
  AnyValue value = 2;
}

message Resource {
  repeated KeyValue attributes = 1;
}

message Span {
  bytes trace_id = 1;
  bytes span_id = 2;
  // 官方 OTLP:
  // 3: trace_state
  // 4: parent_span_id
  // 5: name
  string trace_state = 3;
  bytes parent_span_id = 4;
  string name = 5;
}

message ScopeSpans {
  // 官方 OTLP: 1 是 scope，2 才是 spans
  // 如果把 spans 写成 1，会导致解析结果字段错位，从而让 Span.name 等字段变得莫名其妙。
  repeated Span spans = 2;
}

message ResourceSpans {
  Resource resource = 1;
  repeated ScopeSpans scope_spans = 2;
}

message ExportTraceServiceRequest {
  repeated ResourceSpans resource_spans = 1;
}
`;

const otlpRoot = protobuf.parse(otlpTraceProto).root;
const ExportTraceServiceRequest = otlpRoot.lookupType('ExportTraceServiceRequest');

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString('hex');
}

// 处理多种 protobufjs toObject 结果里 bytes 字段的形态
function extractBytes(maybeBytes) {
  if (!maybeBytes) return [];
  // protobufjs 的 Buffer 表示：{ type: 'Buffer', data: [...] }
  if (Array.isArray(maybeBytes)) return maybeBytes;
  if (maybeBytes.type === 'Buffer' && Array.isArray(maybeBytes.data)) {
    return maybeBytes.data;
  }
  if (maybeBytes instanceof Uint8Array) {
    return Array.from(maybeBytes);
  }
  return [];
}

app.post('/v1/traces', (req, res) => {
  try {
    const contentType = req.headers['content-type'] || '';
    console.log('[迷你收集器] 收到 /v1/traces 请求, content-type =', contentType);

    const isProtobuf = contentType.includes('application/x-protobuf');

    if (isProtobuf) {
      const buffer = req.body;
      if (!buffer || !buffer.length) {
        console.log('[迷你收集器] 收到空的 protobuf Trace');
        return res.status(200).send();
      }

      const decoded = ExportTraceServiceRequest.decode(buffer);
      const obj = ExportTraceServiceRequest.toObject(decoded, { defaults: false });

      // 兼容不同字段命名风格：resource_spans / resourceSpans
      const resourceSpans = obj.resource_spans || obj.resourceSpans || [];

      if (!Array.isArray(resourceSpans) || resourceSpans.length === 0) {
        console.log(
          '[迷你收集器] 已解析 protobuf Trace，但 resource_spans 为空，原始对象：',
          JSON.stringify(obj)
        );
      } else {
        console.log(
          `[迷你收集器] 解析到 ${resourceSpans.length} 组 ResourceSpans（protobuf，可能来自后端服务）`
        );
      }

      resourceSpans.forEach((resourceSpan, rsIndex) => {
        const attrs = (resourceSpan.resource && (resourceSpan.resource.attributes || resourceSpan.resource.Attributes)) || [];
        const serviceNameAttr =
          attrs.find((a) => a.key === 'service.name') || attrs.find((a) => a.key === 'serviceName');
        const serviceName =
          serviceNameAttr && serviceNameAttr.value && (serviceNameAttr.value.string_value || serviceNameAttr.value.stringValue)
            ? (serviceNameAttr.value.string_value || serviceNameAttr.value.stringValue)
            : 'unknown-service';

        // 兼容 scope_spans / scopeSpans
        const scopeSpans = resourceSpan.scope_spans || resourceSpan.scopeSpans || [];

        scopeSpans.forEach((scopeSpan, ssIndex) => {
          (scopeSpan.spans || []).forEach((span, spanIndex) => {
            // 兼容 trace_id / traceId, span_id / spanId
            const traceBytes = extractBytes(span.trace_id || span.traceId);
            const spanBytes = extractBytes(span.span_id || span.spanId);
            const traceId = bytesToHex(traceBytes);
            const spanId = bytesToHex(spanBytes);
            console.log(
              `[汇总日志] (protobuf) 组${rsIndex}/scope${ssIndex}/span${spanIndex} ` +
                `服务: ${serviceName} | TraceID: ${traceId} | SpanID: ${spanId} | Span名称: ${span.name}`
            );
          });
        });
      });

      return res.status(200).send();
    }

    // JSON 情况（目前主要给调试用）
    const body = req.body || {};
    const spans = body.resourceSpans || [];

    spans.forEach((resourceSpan) => {
      const serviceNameAttr =
        resourceSpan.resource?.attributes?.find((a) => a.key === 'service.name') ||
        resourceSpan.resource?.attributes?.find((a) => a.key === 'serviceName');
      const serviceName = serviceNameAttr?.value?.stringValue || 'unknown-service';

      (resourceSpan.scopeSpans || []).forEach((scopeSpan) => {
        (scopeSpan.spans || []).forEach((span) => {
          console.log(
            `[汇总日志] 服务: ${serviceName} | TraceID: ${span.traceId} | Span名称: ${span.name}`
          );
        });
      });
    });

    res.status(200).send();
  } catch (e) {
    console.error('[迷你收集器] 解析 /v1/traces 失败:', e);
    res.status(200).send();
  }
});

// Java Agent 还会向 /v1/metrics 和 /v1/logs 发送 OTLP 数据。
// 这里为了避免 400/500 报错，简单地接收并丢弃（不做解析）。
app.post('/v1/metrics', (req, res) => {
  console.log('[迷你收集器] 收到 /v1/metrics 上报（暂不解析），返回 200');
  res.status(200).send();
});

app.post('/v1/logs', (req, res) => {
  console.log('[迷你收集器] 收到 /v1/logs 上报（暂不解析），返回 200');
  res.status(200).send();
});

app.listen(4318, () => {
  console.log('迷你收集器已启动，监听端口 4318 (OTLP/HTTP)');
});


