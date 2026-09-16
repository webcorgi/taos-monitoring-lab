package kr.taos.lab.controller;

import kr.taos.lab.domain.Prediction;
import kr.taos.lab.mapper.PredictionMapper;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/predictions")
public class PredictionController {
    private final PredictionMapper mapper;

    public PredictionController(PredictionMapper mapper) {
        this.mapper = mapper;
    }

    @GetMapping("/latest")
    public ResponseEntity<?> latest() {
        Prediction prediction = mapper.findLatest();
        return prediction == null ? ResponseEntity.noContent().build() : ResponseEntity.ok(prediction);
    }
}
