CREATE TABLE "provinces" (
  "provinces_id" integer PRIMARY KEY,
  "geography_id" integer,
  "name_th" varchar,
  "name_th_short" varchar,
  "name_en" varchar
);

CREATE TABLE "geographies" (
  "geographies_id" integer PRIMARY KEY,
  "name" varchar
);

CREATE TABLE "districts" (
  "districts_id" integer PRIMARY KEY,
  "province_code" integer,
  "name_th" varchar,
  "name_en" varchar
);

CREATE TABLE "subdistricts" (
  "subdistricts_id" integer PRIMARY KEY,
  "district_code" integer,
  "zip_code" varchar,
  "name_th" varchar,
  "name_en" varchar,
  "latitude" decimal(10,8),
  "longitude" decimal(11,8)
);

CREATE TABLE "farmers" (
  "farmer_id" integer PRIMARY KEY,
  "factory_id" integer,
  "service_area_id" integer,
  "updated_uid" integer,
  "thai_national_id" varchar,
  "thai_farmer_id" varchar,
  "phone" varchar,
  "first_name" varchar,
  "last_name" varchar,
  "line_user_id" varchar,
  "update_at" timestamp
);

CREATE TABLE "factories" (
  "factory_id" integer PRIMARY KEY,
  "updated_uid" integer,
  "name" varchar,
  "initial" varchar,
  "note" text,
  "update_at" timestamp
);

CREATE TABLE "service_areas" (
  "service_area_id" integer PRIMARY KEY,
  "factory_id" integer,
  "updated_uid" integer,
  "code" varchar,
  "name" varchar,
  "note" text,
  "update_at" timestamp
);

CREATE TABLE "departments" (
  "departments_id" integer PRIMARY KEY,
  "name" varchar,
  "created_at" timestamp,
  "updated_at" timestamp
);

CREATE TABLE "users" (
  "user_id" integer PRIMARY KEY,
  "department_id" integer,
  "update_uid" integer,
  "username" varchar,
  "first_name" varchar,
  "last_name" varchar,
  "email" varchar,
  "role_id" integer,
  "updated_at" timestamp
);

CREATE TABLE "lands" (
  "land_id" integer PRIMARY KEY,
  "farmer_id" integer,
  "subdistrict_code" integer,
  "updated_uid" integer,
  "land_camp_id" integer,
  "land_code" varchar,
  "name" varchar,
  "quota_code" varchar,
  "area_size" float,
  "land_unit_prefix_id" integer,
  "land_unit_id" integer,
  "land_size" float,
  "land_planSize" float,
  "latitude" decimal(10,8),
  "longitude" decimal(11,8),
  "zip_code" varchar,
  "village" varchar,
  "update_at" timestamp
);

CREATE TABLE "role" (
  "role_id" integer PRIMARY KEY,
  "role_name" varchar,
  "role_name_eng" varchar
);

CREATE TABLE "landmaps" (
  "landmap_id" integer PRIMARY KEY,
  "landmap_idCode" varchar,
  "landmap_area_size" float,
  "landmap_unit_prefix_id" integer,
  "landmap_unit_id" integer,
  "landmap_latitude" decimal(10,8),
  "landmap_longitude" decimal(11,8),
  "landmap_info" text,
  "landmap_create_at" timestamp,
  "landmap_update_at" timestamp
);

CREATE TABLE "landmaps_owner" (
  "landmap_owner_id" integer PRIMARY KEY,
  "landmap_owner_uid" integer,
  "landmap_owner_fid" integer,
  "landmap_id" integer,
  "landmap_owner_create_at" timestamp,
  "landmap_owner_update_at" timestamp,
  "landmap_owner_info" text
);

CREATE TABLE "lands_landmaps_mapping" (
  "land_landmap_mapping_id" integer PRIMARY KEY,
  "farmer_id" integer,
  "landmap_id" integer,
  "land_id" integer,
  "land_camp_id" integer,
  "land_landmap_mapping_update_at" timestamp,
  "land_landmap_mapping_create_at" timestamp,
  "land_landmap_mapping_update_uid" integer,
  "land_landmap_mapping_exStatus" integer
);

CREATE TABLE "lands_landmaps_mapping_exStatus" (
  "land_landmap_mapping_exStatus_id" integer PRIMARY KEY,
  "land_landmap_mapping_exStatus_name" varchar
);

CREATE TABLE "lands_camps" (
  "land_camp_id" integer PRIMARY KEY,
  "land_camp_idCode" varchar,
  "land_camp_name" varchar,
  "land_camp_latitude" decimal(10,8),
  "land_camp_longitude" decimal(11,8),
  "land_camp_info" text,
  "land_camp_update_at" timestamp,
  "land_camp_uid" integer,
  "land_camp_group_id" integer
);

CREATE TABLE "lands_camps_groups" (
  "land_camp_group_id" integer PRIMARY KEY,
  "land_camp_group_idCode" varchar,
  "land_camp_group_name" varchar,
  "land_camp_group_update_at" timestamp
);

CREATE TABLE "lands_weatherStationRec" (
  "land_weatherStationRec_id" integer PRIMARY KEY,
  "land_camp_id" integer,
  "land_weatherStationRec_latitude" decimal(10,8),
  "land_weatherStationRec_longitude" decimal(11,8),
  "land_weatherStationRec_create_at" timestamp,
  "land_weatherStationRec_airTemperature" float,
  "land_weatherStationRec_relativeHumidity" float,
  "land_weatherStationRec_barometricPressure" float,
  "land_weatherStationRec_windSP" float,
  "land_weatherStationRec_rainfall" float,
  "land_weatherStationRec_solarRadiation_UV" float,
  "land_weatherStationRec_soilMoisture_soilTemp" float,
  "land_weatherStationRec_dewPoint" float,
  "land_weatherStationRec_evapotranspiration" float
);

CREATE TABLE "units_prefixs" (
  "unit_prefix_id" integer PRIMARY KEY,
  "unit_prefix_name" varchar,
  "unit_prefix_initial" varchar,
  "unit_prefix_updated_uid" integer,
  "unit_prefix_updated_at" timestamp,
  "unit_prefix_value" float
);

CREATE TABLE "units" (
  "unit_id" integer PRIMARY KEY,
  "unit_name" varchar,
  "unit_initial" varchar,
  "unit_updated_uid" integer,
  "unit_updated_at" timestamp
);

CREATE TABLE "carbonfootprints_types" (
  "carbonfootprint_type_id" integer PRIMARY KEY,
  "cf_type_name_short" varchar,
  "cf_type_name_th" varchar,
  "cf_type_name_en" varchar,
  "cf_type_create_at" timestamp,
  "cf_type_update_at" timestamp
);

CREATE TABLE "groups_emissions_factors" (
  "group_emission_factor_id" integer PRIMARY KEY,
  "group_emission_factor_idCode" varchar,
  "group_emission_factor_name_short" varchar,
  "group_emission_factor_name" varchar,
  "group_emission_factor_info" varchar,
  "carbonfootprint_type_id" integer
);

CREATE TABLE "coefficients_emissions_factors" (
  "coefficient_emission_factor_id" integer PRIMARY KEY,
  "coef_em_factor_idCode" varchar,
  "carbonfootprint_type_id" integer,
  "group_emission_factor_id" integer,
  "coef_em_factor_name" varchar,
  "coef_em_factor_info" text,
  "unit_prefix_id" integer,
  "unit_id" integer,
  "coef_em_factor_value_co2" float,
  "unit_prefix_id_co2" integer,
  "unit_id_co2" integer,
  "coef_em_factor_value_ch4foss" float,
  "unit_prefix_id_ch4foss" integer,
  "unit_id_ch4foss" integer,
  "coef_em_factor_value_ch4" float,
  "unit_prefix_id_ch4" integer,
  "unit_id_ch4" integer,
  "coef_em_factor_value_n2o" float,
  "unit_prefix_id_n2o" integer,
  "unit_id_n2o" integer,
  "coef_em_factor_value_total" float,
  "unit_prefix_id_total" integer,
  "unit_id_total" integer,
  "coef_em_factor_ref" integer,
  "coef_em_factor_updatePostDateRef" timestamp,
  "create_at" timestamp,
  "update_at" timestamp,
  "update_uid" integer
);

CREATE TABLE "resource_used_type" (
  "resource_used_type_id" integer PRIMARY KEY,
  "resc_used_type_name" varchar,
  "resc_used_type_info" text,
  "resc_used_type_create_at" timestamp,
  "resc_used_type_update_at" timestamp
);

CREATE TABLE "activities_equipments" (
  "act_equipment_id" integer PRIMARY KEY,
  "act_equipment_name" varchar,
  "act_equipment_date_add" timestamp,
  "act_equipment_price" float,
  "act_equipment_info" text,
  "resource_used_type_id" integer
);

CREATE TABLE "activities_fertilizers" (
  "act_fertilizer_id" integer PRIMARY KEY,
  "act_fertilizer_name" varchar,
  "act_fertilizer_date_add" timestamp,
  "act_fertilizer_price" float,
  "act_fertilizer_price_perUnit" float,
  "act_fertilizer_info" text,
  "resource_used_type_id" integer,
  "n_pct" int,
  "p_pct" int,
  "k_pct" int,
  "act_fertilizer_update_uid" integer,
  "act_fertilizer_update_at" timestamp,
  "act_fertilizer_type" integer,
  "act_fertilizer_formular" varchar,
  "act_fertilizer_quantity" int
);

CREATE TABLE "activities_header_detail_type" (
  "act_header_detail_type_id" integer PRIMARY KEY,
  "act_header_type_id" integer,
  "act_header_detail_type_name_th" varchar
);

CREATE TABLE "activities_header_type" (
  "act_header_type_id" integer PRIMARY KEY,
  "act_header_type_idCode" varchar,
  "act_header_type_name_th" varchar,
  "act_header_type_name_en" varchar,
  "act_header_type_create_at" timestamp,
  "act_header_type_update_uid" integer
);

CREATE TABLE "activities_header" (
  "activities_header_id" integer PRIMARY KEY,
  "land_id" integer,
  "farmer_id" integer,
  "activities_header_idCode" varchar,
  "activities_header_curlatitude" decimal(10,8),
  "activities_header_curlongitude" decimal(11,8),
  "activities_header_startDate" timestamp,
  "activities_header_create_at" timestamp,
  "activities_header_update_uid" integer,
  "act_header_type_id" integer,
  "act_header_typeLand_id" integer,
  "act_header_typeSugarCane_id" integer,
  "activities_header_info" text
);

CREATE TABLE "activities_header_typeLand" (
  "act_header_typeLand_id" integer PRIMARY KEY,
  "act_header_typeLand_name" varchar
);

CREATE TABLE "activities_header_typeSugarCane" (
  "act_header_typeSugarCane_id" integer PRIMARY KEY,
  "act_header_typeSugarCane_name" varchar
);

CREATE TABLE "log_activities_detail" (
  "log_act_detail_id" integer PRIMARY KEY,
  "act_productYear_id" integer,
  "activities_header_id" integer,
  "act_header_type_id" integer,
  "act_header_detail_type_id" integer,
  "act_header_detail_type_update_uid" integer,
  "act_equipment_id" integer,
  "act_fertilizer_id" integer,
  "act_chemiscal_id" integer,
  "act_resourceOther_id" integer,
  "resource_used_type_id" integer,
  "unit_prefix_id" integer,
  "unit_id" integer,
  "log_act_detail_quatity" int,
  "log_act_detail_volumePerUnit" float,
  "log_act_detail_volumeAll" float,
  "log_act_detail_areawork" float,
  "log_act_detail_create_at" timestamp,
  "log_act_detail_calStatus_id" integer
);

CREATE TABLE "activities_productYear" (
  "act_productYear_id" integer PRIMARY KEY,
  "act_productYear_name" varchar,
  "act_productYear_info" varchar,
  "act_productyear_create_at" timestamp,
  "act_productYear_update_at" timestamp,
  "act_productYear_update_uid" integer
);

CREATE TABLE "log_act_detail_calStatus" (
  "log_act_detail_calStatus_id" integer PRIMARY KEY,
  "log_act_detail_calStatus_name" varchar,
  "create_at" timestamp
);

CREATE TABLE "activities_chemiscals" (
  "act_chemiscal_id" integer PRIMARY KEY,
  "act_chemiscal_name" varchar,
  "act_chemiscal_date_add" timestamp,
  "resource_used_type_id" integer,
  "act_chemiscal_info" text,
  "act_chemiscal_update_uid" integer,
  "act_chemiscal_update_at" timestamp
);

CREATE TABLE "coefficients_emissions_factors_gwp" (
  "coefficients_emissions_factors_gwp_id" integer PRIMARY KEY,
  "coef_em_factor_gwp_name" varchar,
  "coef_em_factor_gwp_name_en" varchar,
  "coef_em_factor_gwp_value" float,
  "coef_em_factor_gwp_info" text,
  "coef_em_factor_gwp_update_uid" integer,
  "coef_em_factor_gwp_create_at" timestamp,
  "coef_em_factor_gwp_update_at" timestamp,
  "coef_em_factor_gwp_ref" integer
);

CREATE TABLE "carbon_process_queue" (
  "carbon_process_queue_id" integer PRIMARY KEY,
  "log_act_detail_id" integer UNIQUE,
  "log_act_detail_calStatus_id" integer,
  "land_id" integer,
  "land_camp_id" integer,
  "carbon_process_queue_dateWork" timestamp,
  "carbon_roundCal_id" integer,
  "N" float,
  "carbon_process_queue_info" text,
  "carbon_process_queue_resultValue" decimal(14,4),
  "unit_prefix_id_resultValue" integer,
  "unit_id_resultValue" integer,
  "carbon_process_queue_resultValueCreditCalc" decimal(14,4),
  "unit_prefix_id_resultValueCreditCalc" integer,
  "unit_id_resultValueCreditCalc" integer,
  "carbon_process_queue_retry_count" integer,
  "carbon_process_queue_error_message" text,
  "carbon_process_queue_create_at" timestamp,
  "carbon_process_queue_started_at" timestamp,
  "carbon_process_queue_ended_at" timestamp,
  "carbon_process_queue_updated_at" timestamp
);

CREATE TABLE "carbon_typeCal" (
  "carbon_typeCal_id" integer PRIMARY KEY,
  "carbon_typeCal_name" varchar,
  "carbon_typeCal_create_at" timestamp,
  "carbon_typeCal_update_at" timestamp,
  "carbon_typeCal_update_uid" integer
);

CREATE TABLE "carbon_roundCal" (
  "carbon_roundCal_id" integer PRIMARY KEY,
  "carbon_roundCal_idCode" varchar,
  "carbon_typeCal_id" integer,
  "carbon_roundCal_info" text,
  "carbon_roundCal_create_at" timestamp,
  "carbon_roundCal_update_at" timestamp,
  "carbon_roundCal_update_uid" integer
);

CREATE TABLE "activities_fileNameUse" (
  "activities_fileNameUse_id" integer PRIMARY KEY,
  "activities_fileNameUse_name" varchar,
  "activities_fileNameUse_rowCount" integer,
  "activities_fileNameUse_columnCount" integer,
  "activities_fileNameUse_create_at" timestamp,
  "activities_fileNameUse_update_at" timestamp,
  "activities_fileNameUse_update_uid" integer
);

CREATE TABLE "activities_resourceOther" (
  "act_resourceOther_id" integer PRIMARY KEY,
  "act_resourceOther_name" varchar,
  "act_resourceOther_create_at" timestamp,
  "resource_used_type_id" integer,
  "act_resourceOther_info" text,
  "act_resourceOther_update_uid" integer,
  "act_resourceOther_update_at" timestamp
);

CREATE TABLE "carbon_soc" (
  "carbon_soc_id" integer PRIMARY KEY,
  "land_id" integer,
  "carbon_soc_idCode" varchar,
  "carbon_soc_socSampleIT" decimal(14,4),
  "unit_socSampleIT" integer,
  "carbon_soc_bdSampleIt" decimal(14,4),
  "unit_socbdSampleIT" integer,
  "carbon_soc_depSampleIT" decimal(14,4),
  "unit_depSampleIT" integer,
  "carbon_soc_socIT" decimal(14,4),
  "unit_socIT" integer,
  "carbon_soc_socIT_perRai" decimal(14,4),
  "unit_socIT_perRai" integer,
  "carbon_soc_numLandSample" integer,
  "carbon_soc_numSample" integer,
  "carbon_soc_yearBeginPro" varchar,
  "carbon_soc_create_at" timestamp,
  "carbon_soc_update_at" timestamp,
  "carbon_soc_update_uid" integer
);

CREATE TABLE "carbon_soilImprovementPlants" (
  "carbon_soilImprovementPlant_id" integer PRIMARY KEY,
  "land_id" integer,
  "carbon_soilImprovementPlant_idCode" varchar,
  "carbon_soilImprovementPlant_mc" decimal(14,4),
  "unit_mc" integer,
  "carbon_soilImprovementPlant_nc" decimal(14,4),
  "unit_nc" integer,
  "carbon_soilImprovementPlant_fnFix" decimal(14,4),
  "unit_fnFix" integer,
  "carbon_soilImprovementPlant_fnFix_perRai" decimal(14,4),
  "unit_fnFix_perRai" integer,
  "act_resourceOther_id" integer,
  "carbon_soilImprovementPlant_create_at" timestamp,
  "carbon_soilImprovementPlant_update_at" timestamp,
  "carbon_soilImprovementPlant_update_uid" integer
);

COMMENT ON TABLE "users" IS 'role in this not sure to create an table';

COMMENT ON TABLE "landmaps" IS 'ตรงนี้อาจจะเอารูปภาพมาใส่ถ้ามี เป็นของโฉนด';

COMMENT ON TABLE "units_prefixs" IS 'prefix unit is an kilo=1000 mega=100000';

COMMENT ON TABLE "carbon_process_queue" IS 'I want more detail about unique';

ALTER TABLE "provinces" ADD FOREIGN KEY ("geography_id") REFERENCES "geographies" ("geographies_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "districts" ADD FOREIGN KEY ("province_code") REFERENCES "provinces" ("provinces_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "subdistricts" ADD FOREIGN KEY ("district_code") REFERENCES "districts" ("districts_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "factories" ADD FOREIGN KEY ("updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "service_areas" ADD FOREIGN KEY ("factory_id") REFERENCES "factories" ("factory_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "service_areas" ADD FOREIGN KEY ("updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("department_id") REFERENCES "departments" ("departments_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "users" ADD FOREIGN KEY ("role_id") REFERENCES "role" ("role_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "farmers" ADD FOREIGN KEY ("factory_id") REFERENCES "factories" ("factory_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "farmers" ADD FOREIGN KEY ("service_area_id") REFERENCES "service_areas" ("service_area_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "farmers" ADD FOREIGN KEY ("updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("farmer_id") REFERENCES "farmers" ("farmer_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("subdistrict_code") REFERENCES "subdistricts" ("subdistricts_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("land_camp_id") REFERENCES "lands_camps" ("land_camp_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("land_unit_prefix_id") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands" ADD FOREIGN KEY ("land_unit_id") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "landmaps" ADD FOREIGN KEY ("landmap_unit_prefix_id") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "landmaps" ADD FOREIGN KEY ("landmap_unit_id") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "landmaps_owner" ADD FOREIGN KEY ("landmap_owner_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "landmaps_owner" ADD FOREIGN KEY ("landmap_owner_fid") REFERENCES "farmers" ("farmer_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "landmaps_owner" ADD FOREIGN KEY ("landmap_id") REFERENCES "landmaps" ("landmap_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("farmer_id") REFERENCES "farmers" ("farmer_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("landmap_id") REFERENCES "landmaps" ("landmap_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("land_id") REFERENCES "lands" ("land_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("land_camp_id") REFERENCES "lands_camps" ("land_camp_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("land_landmap_mapping_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_landmaps_mapping" ADD FOREIGN KEY ("land_landmap_mapping_exStatus") REFERENCES "lands_landmaps_mapping_exStatus" ("land_landmap_mapping_exStatus_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_weatherStationRec" ADD FOREIGN KEY ("land_camp_id") REFERENCES "lands_camps" ("land_camp_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_camps" ADD FOREIGN KEY ("land_camp_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "lands_camps" ADD FOREIGN KEY ("land_camp_group_id") REFERENCES "lands_camps_groups" ("land_camp_group_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "units" ADD FOREIGN KEY ("unit_updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "units_prefixs" ADD FOREIGN KEY ("unit_prefix_updated_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "groups_emissions_factors" ADD FOREIGN KEY ("carbonfootprint_type_id") REFERENCES "carbonfootprints_types" ("carbonfootprint_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("carbonfootprint_type_id") REFERENCES "carbonfootprints_types" ("carbonfootprint_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("group_emission_factor_id") REFERENCES "groups_emissions_factors" ("group_emission_factor_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id_co2") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id_co2") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id_ch4foss") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id_ch4foss") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id_ch4") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id_ch4") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id_n2o") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id_n2o") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_prefix_id_total") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors" ADD FOREIGN KEY ("unit_id_total") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_equipments" ADD FOREIGN KEY ("resource_used_type_id") REFERENCES "resource_used_type" ("resource_used_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_fertilizers" ADD FOREIGN KEY ("resource_used_type_id") REFERENCES "resource_used_type" ("resource_used_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_fertilizers" ADD FOREIGN KEY ("act_fertilizer_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_chemiscals" ADD FOREIGN KEY ("resource_used_type_id") REFERENCES "resource_used_type" ("resource_used_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_chemiscals" ADD FOREIGN KEY ("act_chemiscal_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header_detail_type" ADD FOREIGN KEY ("act_header_type_id") REFERENCES "activities_header_type" ("act_header_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header_type" ADD FOREIGN KEY ("act_header_type_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("land_id") REFERENCES "lands" ("land_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("farmer_id") REFERENCES "farmers" ("farmer_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("activities_header_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("act_header_type_id") REFERENCES "activities_header_type" ("act_header_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("act_header_typeLand_id") REFERENCES "activities_header_typeLand" ("act_header_typeLand_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_header" ADD FOREIGN KEY ("act_header_typeSugarCane_id") REFERENCES "activities_header_typeSugarCane" ("act_header_typeSugarCane_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("activities_header_id") REFERENCES "activities_header" ("activities_header_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_header_type_id") REFERENCES "activities_header_type" ("act_header_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_header_detail_type_id") REFERENCES "activities_header_detail_type" ("act_header_detail_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_header_detail_type_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_equipment_id") REFERENCES "activities_equipments" ("act_equipment_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_fertilizer_id") REFERENCES "activities_fertilizers" ("act_fertilizer_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_chemiscal_id") REFERENCES "activities_chemiscals" ("act_chemiscal_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("resource_used_type_id") REFERENCES "resource_used_type" ("resource_used_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("unit_prefix_id") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("unit_id") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("log_act_detail_calStatus_id") REFERENCES "log_act_detail_calStatus" ("log_act_detail_calStatus_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "log_activities_detail" ADD FOREIGN KEY ("act_productYear_id") REFERENCES "activities_productYear" ("act_productYear_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "coefficients_emissions_factors_gwp" ADD FOREIGN KEY ("coef_em_factor_gwp_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("log_act_detail_id") REFERENCES "log_activities_detail" ("log_act_detail_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("log_act_detail_calStatus_id") REFERENCES "log_act_detail_calStatus" ("log_act_detail_calStatus_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("land_id") REFERENCES "lands" ("land_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("land_camp_id") REFERENCES "lands_camps" ("land_camp_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("carbon_roundCal_id") REFERENCES "carbon_roundCal" ("carbon_roundCal_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("unit_prefix_id_resultValue") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("unit_id_resultValue") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("unit_prefix_id_resultValueCreditCalc") REFERENCES "units_prefixs" ("unit_prefix_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_process_queue" ADD FOREIGN KEY ("unit_id_resultValueCreditCalc") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_typeCal" ADD FOREIGN KEY ("carbon_typeCal_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_roundCal" ADD FOREIGN KEY ("carbon_typeCal_id") REFERENCES "carbon_typeCal" ("carbon_typeCal_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_roundCal" ADD FOREIGN KEY ("carbon_roundCal_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_fileNameUse" ADD FOREIGN KEY ("activities_fileNameUse_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_resourceOther" ADD FOREIGN KEY ("resource_used_type_id") REFERENCES "resource_used_type" ("resource_used_type_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "activities_resourceOther" ADD FOREIGN KEY ("act_resourceOther_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("land_id") REFERENCES "lands" ("land_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("unit_socSampleIT") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("unit_socbdSampleIT") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("unit_depSampleIT") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("unit_socIT") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("carbon_soc_update_uid") REFERENCES "users" ("user_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soc" ADD FOREIGN KEY ("unit_socIT_perRai") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("land_id") REFERENCES "lands" ("land_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("unit_mc") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("unit_nc") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("unit_fnFix") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("act_resourceOther_id") REFERENCES "activities_resourceOther" ("act_resourceOther_id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "carbon_soilImprovementPlants" ADD FOREIGN KEY ("unit_fnFix_perRai") REFERENCES "units" ("unit_id") DEFERRABLE INITIALLY IMMEDIATE;
