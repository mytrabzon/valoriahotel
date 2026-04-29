-- feed-media bucket: 50 MiB sınırı uzun telefon videolarını reddediyordu (ör. ~93 MB → HTTP 400).
-- 150 MiB: tipik feed klipleri için yeterli üst sınır.

UPDATE storage.buckets
SET file_size_limit = 157286400
WHERE id = 'feed-media';
