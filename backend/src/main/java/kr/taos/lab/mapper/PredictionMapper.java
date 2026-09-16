package kr.taos.lab.mapper;

import kr.taos.lab.domain.Prediction;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface PredictionMapper {

    @Select("""
        SELECT id, device_id, observed_at, model_version, is_anomaly,
               anomaly_score, features::text AS features, created_at
        FROM prediction
        ORDER BY observed_at DESC, created_at DESC
        LIMIT 1
        """)
    Prediction findLatest();
}
