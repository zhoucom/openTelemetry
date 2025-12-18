package com.example.serviceb.filter;

import jakarta.servlet.Filter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * 简单的 Filter：如果请求头里有 traceparent，就复制到响应头里，
 * 方便在浏览器里直接看到与后端日志/Trace 对应的 traceId。
 */
@Component
public class TraceparentEchoFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest httpReq = (HttpServletRequest) request;
        HttpServletResponse httpRes = (HttpServletResponse) response;

        String traceparent = httpReq.getHeader("traceparent");
        if (traceparent != null && !traceparent.isEmpty()) {
            httpRes.setHeader("traceparent", traceparent);
        }

        chain.doFilter(request, response);
    }
}


