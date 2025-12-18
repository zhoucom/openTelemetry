package com.example.servicea.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/a")
@CrossOrigin(origins = "http://localhost:5173")
public class DemoController {

    private static final Logger logger = LoggerFactory.getLogger(DemoController.class);

    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${service-b.url:http://localhost:8082}")
    private String serviceBUrl;

    @GetMapping("/success")
    public ResponseEntity<String> success() {
        logger.info("[A] 收到 /success 请求，准备调用 B 成功接口");
        String responseFromB = restTemplate.getForObject(serviceBUrl + "/api/b/success", String.class);
        logger.info("[A] B 成功返回，响应内容: {}", responseFromB);
        return ResponseEntity.ok("Service A success, B says: " + responseFromB);
    }

    @GetMapping("/error")
    public ResponseEntity<String> error() {
        logger.info("[A] 收到 /error 请求，准备调用 B 错误接口");
        try {
            restTemplate.getForObject(serviceBUrl + "/api/b/error", String.class);
        } catch (Exception ex) {
            logger.error("[A] 调用 B /error 接口发生异常，将错误返回给前端", ex);
            return ResponseEntity.internalServerError()
                    .body("Service A saw error from B: " + ex.getMessage());
        }
        return ResponseEntity.ok("Service A triggered error in service B");
    }
}


