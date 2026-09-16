package kr.taos.lab;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication
public class MonitoringLabApplication {
    public static void main(String[] args) {
        SpringApplication.run(MonitoringLabApplication.class, args);
    }
}
