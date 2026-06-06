ALTER TABLE "log_activities_detail"
ALTER COLUMN "log_act_detail_quatity" TYPE double precision
USING "log_act_detail_quatity"::double precision;
