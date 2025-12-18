package com.example.serviceb.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/b")
public class ServiceBController {

    private static final Logger logger = LoggerFactory.getLogger(ServiceBController.class);

    @GetMapping("/success")
    public ResponseEntity<String> success() {
        logger.info("[B] 处理 /success 业务逻辑");
        return ResponseEntity.ok("Service B success");
    }

    @GetMapping("/error")
    public ResponseEntity<String> error() {
        logger.warn("[B] 即将模拟一个业务异常，抛出 500 错误");
        // 简单抛出一个 500 错误，制造一条错误 Trace
        throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Service B simulated error");
    }
}


