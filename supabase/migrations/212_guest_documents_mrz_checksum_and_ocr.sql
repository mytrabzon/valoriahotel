-- MRZ: checksum audit column + which OCR path produced the row (e.g. expo-text-extractor).
ALTER TABLE ops.guest_documents
  ADD COLUMN IF NOT EXISTS mrz_checksum_valid boolean,
  ADD COLUMN IF NOT EXISTS ocr_engine text;

COMMENT ON COLUMN ops.guest_documents.mrz_checksum_valid IS
  'True when MRZ check digits passed (ICAO 9303) at scan time; null if not MRZ path.';
COMMENT ON COLUMN ops.guest_documents.ocr_engine IS
  'On-device OCR engine id e.g. expo-text-extractor; null for manual/draft.';
