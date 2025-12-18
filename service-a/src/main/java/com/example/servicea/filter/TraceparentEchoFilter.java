package com.example.servicea.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 简单的 Filter：
 * 1. 如果请求头里有 traceparent，就复制到响应头里；
 * 2. 额外把 traceId / spanId 写入 MDC（trace_id / span_id），让 logback 能打印出来。
 */
@Component
public class TraceparentEchoFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpRes = (HttpServletResponse) response;

        String traceparent = httpReq.getHeader("traceparent");
        try {
            if (traceparent != null && !traceparent.isEmpty()) {
                // 回写到响应头，方便前端在 response header 里看到
                httpRes.setHeader("traceparent", traceparent);

                // 解析 W3C traceparent: version-traceid-spanid-flags
                String[] parts = traceparent.split("-");
                if (parts.length >= 4) {
                    String traceId = parts[1];
                    String spanId = parts[2];
                    MDC.put("trace_id", traceId);
                    MDC.put("span_id", spanId);
                }
            }

            chain.doFilter(request, response);
        } finally {
            // 避免线程复用导致的脏数据
            MDC.remove("trace_id");
            MDC.remove("span_id");
        }
    }
}


