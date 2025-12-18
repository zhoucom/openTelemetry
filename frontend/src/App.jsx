import { useState } from 'react';

function App() {
  const [result, setResult] = useState('');

  const callBackend = async (type) => {
    setResult('Loading...');
    try {
      const resp = await fetch(`http://localhost:8081/api/a/${type}`);
      const text = await resp.text();
      setResult(`${resp.status}: ${text}`);
    } catch (e) {
      setResult('Request failed: ' + e.message);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>OpenTelemetry Demo 前端</h1>
      <p>点击下面的按钮，模拟一次“成功请求”和一次“错误请求”。</p>
      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <button onClick={() => callBackend('success')}>成功请求</button>
        <button onClick={() => callBackend('error')}>错误请求</button>
      </div>
      <div>
        <strong>返回结果：</strong>
        <pre>{result}</pre>
      </div>
      <p style={{ marginTop: 32, color: '#666' }}>
        Trace 会通过 OTLP/HTTP 发送到迷你收集器，你可以在收集器控制台看到同一个 traceId 下的前后端链路。
      </p>
    </div>
  );
}

export default App;


