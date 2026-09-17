package kr.taos.lab.mapper;

import kr.taos.lab.domain.Measurement;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.time.Instant;
import java.util.List;

@Mapper
public interface MeasurementMapper {

    @Insert("""
        INSERT INTO measurement
            (device_id, observed_at, voltage, current, soc, temperature, quality_status)
        VALUES
            (#{deviceId}, #{observedAt}, #{voltage}, #{current}, #{soc}, #{temperature}, #{qualityStatus})
        ON CONFLICT (device_id, observed_at) DO NOTHING
        """)
    int insert(
            @Param("deviceId") String deviceId,
            @Param("observedAt") Instant observedAt,
            @Param("voltage") Double voltage,
            @Param("current") Double current,
            @Param("soc") Double soc,
            @Param("temperature") Double temperature,
            @Param("qualityStatus") String qualityStatus
    );

    @Select("""
        SELECT id, device_id, observed_at, voltage, current, soc, temperature,
               quality_status, ingested_at
        FROM measurement
        ORDER BY observed_at DESC
        LIMIT #{limit}
        """)
    List<Measurement> findRecent(@Param("limit") int limit);

    @Select("""
        SELECT id, device_id, observed_at, voltage, current, soc, temperature,
               quality_status, ingested_at
        FROM measurement
        WHERE device_id = #{deviceId}
        ORDER BY observed_at DESC
        LIMIT #{limit}
        """)
    List<Measurement> findRecentByDevice(
            @Param("deviceId") String deviceId,
            @Param("limit") int limit
    );
}
