FROM eclipse-temurin:17-jdk

WORKDIR /app

ARG JAR_FILE=target/service-a-0.0.1-SNAPSHOT.jar
COPY ${JAR_FILE} app.jar

# 注意：在构建镜像之前，请先在宿主机执行：
#   cd /Users/lei/Documents/code/openTelemetry
#   cp opentelemetry-javaagent.jar service-a/
# 这样本 Dockerfile 中的 COPY 就能找到真实存在的 opentelemetry-javaagent.jar
COPY opentelemetry-javaagent.jar /app/opentelemetry-javaagent.jar

EXPOSE 8081

ENTRYPOINT ["java", "-javaagent:/app/opentelemetry-javaagent.jar", "-jar", "app.jar"]


